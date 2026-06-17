import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError
from pymongo.server_api import ServerApi

logger = logging.getLogger(__name__)

class WebAnalyticsDB:
    def __init__(self):
        self.client: Optional[MongoClient] = None
        self.db: Any = None
        self.visitors_collection: Any = None
        self._connect()

    def _connect(self):
        mongo_uri = os.environ.get("MONGODB_URI_WEB")
        if not mongo_uri:
            logger.error("MONGODB_URI_WEB environment variable not set. Web analytics will be disabled.")
            return
        try:
            # Specify the Server API version (e.g., ServerApi("1"))
            self.client = MongoClient(mongo_uri, server_api=ServerApi('1'))
            self.client.admin.command('ping') # Test connection
            self.db = self.client.get_database()
            self.visitors_collection = self.db.web_visitors
            # Ensure guest_id is indexed for fast lookups
            self.visitors_collection.create_index("guest_id", unique=True)
            self.visitors_collection.create_index("first_visit_time")
            self.visitors_collection.create_index("last_visit_time")
            logger.info("Successfully connected to MongoDB for web analytics.")
        except ConnectionFailure as e:
            logger.error(f"MongoDB web analytics connection failed: {e}. Analytics will be disabled.")
            self.client = None
        except PyMongoError as e:
            logger.error(f"MongoDB web analytics error during connection setup: {e}. Analytics will be disabled.")
            self.client = None

    def track_visit(self, guest_id: str, user_agent: str, ip_address: str, page_url: str) -> Dict[str, Any]:
        if not self.visitors_collection:
            return {}

        now = datetime.utcnow()
        # Basic device type and browser info parsing (can be expanded)
        device_type = "desktop"
        if "Mobi" in user_agent or "Android" in user_agent or "iPhone" in user_agent:
            device_type = "mobile"
        elif "iPad" in user_agent:
            device_type = "tablet"
        
        browser_info = user_agent.split(') ')[-1].split(' ')[0] if ') ' in user_agent else user_agent

        # For country/city, a more robust solution would involve a geo-IP API
        # For now, we'll leave them as None or a placeholder
        country = None # Placeholder
        city = None    # Placeholder

        try:
            # Find existing visitor or create a new one
            visitor = self.visitors_collection.find_one({"guest_id": guest_id})

            if visitor:
                # Returning visitor
                update_fields = {
                    "$set": {
                        "last_visit_time": now,
                        "device_type": device_type,
                        "browser_info": browser_info,
                        "country": country,
                        "city": city,
                    },
                    "$inc": {"num_visits": 1},
                    "$push": {"page_visits": {"url": page_url, "timestamp": now}},
                }
                self.visitors_collection.update_one({"guest_id": guest_id}, update_fields)
                visitor = self.visitors_collection.find_one({"guest_id": guest_id})
            else:
                # New visitor
                new_visitor = {
                    "guest_id": guest_id,
                    "first_visit_time": now,
                    "last_visit_time": now,
                    "total_time_spent": 0.0,
                    "num_visits": 1,
                    "device_type": device_type,
                    "browser_info": browser_info,
                    "country": country,
                    "city": city,
                    "ai_chat_usage": 0,
                    "quiz_attempts": 0,
                    "notes_generated": 0,
                    "page_visits": [{"url": page_url, "timestamp": now}],
                    "sessions": [],
                }
                self.visitors_collection.insert_one(new_visitor)
                visitor = new_visitor
            return visitor
        except PyMongoError as e:
            logger.error(f"Failed to track visit for guest {guest_id} in MongoDB: {e}")
            return {}

    def update_activity(self, guest_id: str, current_page: str, time_spent_on_page: float):
        if not self.visitors_collection:
            return
        try:
            # Update total time spent and current page activity
            self.visitors_collection.update_one(
                {"guest_id": guest_id},
                {
                    "$inc": {"total_time_spent": time_spent_on_page},
                    "$set": {"last_visit_time": datetime.utcnow()},
                    "$push": {"page_visits": {"url": current_page, "timestamp": datetime.utcnow()}}
                }
            )
        except PyMongoError as e:
            logger.error(f"Failed to update activity for guest {guest_id}: {e}")

    def track_session_end(self, guest_id: str, session_start: datetime, session_end: datetime):
        if not self.visitors_collection:
            return
        try:
            duration = (session_end - session_start).total_seconds()
            self.visitors_collection.update_one(
                {"guest_id": guest_id},
                {
                    "$push": {"sessions": {"session_start": session_start, "session_end": session_end, "duration": duration}},
                    "$inc": {"total_time_spent": duration},
                    "$set": {"last_visit_time": session_end}
                }
            )
        except PyMongoError as e:
            logger.error(f"Failed to track session end for guest {guest_id}: {e}")

    def track_feature_usage(self, guest_id: str, feature: str):
        if not self.visitors_collection:
            return
        try:
            if feature == "ai_chat":
                self.visitors_collection.update_one({"guest_id": guest_id}, {"$inc": {"ai_chat_usage": 1}})
            elif feature == "quiz_attempt":
                self.visitors_collection.update_one({"guest_id": guest_id}, {"$inc": {"quiz_attempts": 1}})
            elif feature == "notes_generated":
                self.visitors_collection.update_one({"guest_id": guest_id}, {"$inc": {"notes_generated": 1}})
            self.visitors_collection.update_one({"guest_id": guest_id}, {"$set": {"last_visit_time": datetime.utcnow()}})
        except PyMongoError as e:
            logger.error(f"Failed to track feature usage for guest {guest_id}: {e}")

    def get_dashboard_stats(self) -> Dict[str, Any]:
        if not self.visitors_collection:
            return self._empty_stats()

        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = datetime(now.year, now.month, 1)

        try:
            total_visitors = self.visitors_collection.count_documents({})
            
            # Unique visitors are just total_visitors in this schema as each doc is a unique guest_id
            unique_visitors = total_visitors

            new_visitors_today = self.visitors_collection.count_documents({"first_visit_time": {"$gte": today_start}})
            active_visitors_today = self.visitors_collection.count_documents({"last_visit_time": {"$gte": today_start}})
            returning_visitors = self.visitors_collection.count_documents({"num_visits": {"$gt": 1}})

            # Aggregation for average session duration
            avg_session_pipeline = [
                {"$unwind": "$sessions"},
                {"$group": {"_id": None, "avg_duration": {"$avg": "$sessions.duration"}}}
            ]
            avg_session_result = list(self.visitors_collection.aggregate(avg_session_pipeline))
            avg_session_duration = avg_session_result[0]["avg_duration"] if avg_session_result else 0

            # Aggregation for most visited pages
            most_visited_pages_pipeline = [
                {"$unwind": "$page_visits"},
                {"$group": {"_id": "$page_visits.url", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 5}
            ]
            most_visited_pages = list(self.visitors_collection.aggregate(most_visited_pages_pipeline))

            # Total feature usage
            feature_usage_pipeline = [
                {"$group": {
                    "_id": None,
                    "total_ai_chats": {"$sum": "$ai_chat_usage"},
                    "total_quiz_attempts": {"$sum": "$quiz_attempts"},
                    "total_notes_generated": {"$sum": "$notes_generated"},
                }}
            ]
            feature_usage_result = list(self.visitors_collection.aggregate(feature_usage_pipeline))
            feature_usage = feature_usage_result[0] if feature_usage_result else self._empty_feature_usage()

            # Weekly Growth Graph (e.g., new users per day for the last 7 days)
            weekly_growth = []
            for i in range(7):
                day = today_start - timedelta(days=i)
                next_day = today_start - timedelta(days=i-1)
                new_users_on_day = self.visitors_collection.count_documents({
                    "first_visit_time": {"$gte": day, "$lt": next_day}
                })
                weekly_growth.append({"date": day.strftime("%Y-%m-%d"), "new_users": new_users_on_day})
            weekly_growth.reverse() # Order from oldest to newest

            # Monthly Growth Graph (e.g., new users per week for the last 4 weeks)
            monthly_growth = []
            for i in range(4):
                week_start_i = week_start - timedelta(weeks=i)
                week_end_i = week_start - timedelta(weeks=i-1)
                new_users_in_week = self.visitors_collection.count_documents({
                    "first_visit_time": {"$gte": week_start_i, "$lt": week_end_i}
                })
                monthly_growth.append({"week": week_start_i.strftime("%Y-%m-%d"), "new_users": new_users_in_week})
            monthly_growth.reverse()

            return {
                "total_visitors": total_visitors,
                "unique_visitors": unique_visitors, # Same as total_visitors in this model
                "new_visitors_today": new_visitors_today,
                "active_visitors_today": active_visitors_today,
                "returning_visitors": returning_visitors,
                "average_session_duration": round(avg_session_duration, 2),
                "most_visited_pages": most_visited_pages,
                "total_ai_chats": feature_usage.get("total_ai_chats", 0),
                "total_quiz_attempts": feature_usage.get("total_quiz_attempts", 0),
                "total_notes_generated": feature_usage.get("total_notes_generated", 0),
                "weekly_growth": weekly_growth,
                "monthly_growth": monthly_growth,
            }
        except PyMongoError as e:
            logger.error(f"Failed to retrieve web analytics dashboard stats from MongoDB: {e}")
            return self._empty_stats()

    def _empty_stats(self):
        return {
            "total_visitors": 0,
            "unique_visitors": 0,
            "new_visitors_today": 0,
            "active_visitors_today": 0,
            "returning_visitors": 0,
            "average_session_duration": 0.0,
            "most_visited_pages": [],
            "total_ai_chats": 0,
            "total_quiz_attempts": 0,
            "total_notes_generated": 0,
            "weekly_growth": [],
            "monthly_growth": [],
        }

    def _empty_feature_usage(self):
        return {
            "total_ai_chats": 0,
            "total_quiz_attempts": 0,
            "total_notes_generated": 0,
        }

web_analytics_db = WebAnalyticsDB()
