"""
=====================================================================
 AI NOTEBOOK  -  telegram_bot/bot.py
=====================================================================
The Telegram bot, refactored to import the SHARED backend.database and
backend.ai modules. Its behaviour is IDENTICAL to the original bot:

  /start  /help  /add  /list  /delete  + AI fallback for any text.

By sharing backend.database, the bot and the web app read/write the same
SQLite file and the same `questions` table.

Webhook mode only (no polling) so it runs as a serverless function.
=====================================================================
"""

from __future__ import annotations

import html
import logging
import os

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)
from telegram.ext.filters import User

from telegram_bot.analytics import analytics


from backend import database as db
from backend.ai import answer_question

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("ai-notebook-bot")

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")

if not TELEGRAM_BOT_TOKEN:
    logger.warning("TELEGRAM_BOT_TOKEN is not set! The bot cannot start without it.")

# Public web app URL. Configurable via env var so the bot can be pointed at
# any deployment without code changes.
WEB_APP_URL = os.environ.get(
    "WEB_APP_URL", "https://study-sphere-ai-fc1f.vercel.app/"
)


# ---------------------------------------------------------------------------
# Command text
# ---------------------------------------------------------------------------
WELCOME_TEXT = f"""\
👋 <b>Welcome to AI Notebook Bot!</b>

I help you build your own study Q&amp;A library and answer
anything else with AI. 📚🤖

<b>Available commands:</b>
/start — Show this welcome message
/help — How the bot works
/add — Save a question &amp; answer
       <i>Format:</i> <code>/add question | answer</code>
/list — Show your saved questions
/delete — Delete a question
       <i>Format:</i> <code>/delete ID</code>

💡 <b>Tip:</b> Just send me any question as a normal message.
I'll check your saved answers first, and if I don't find one,
I'll ask the AI for you!

🌐 <b>New:</b> AI Notebook now has a full web app too — notes,
quizzes, flashcards, a ChatGPT-style assistant and more.
{WEB_APP_URL}
"""

HELP_TEXT = """\
📖 <b>How AI Notebook Bot works</b>

<b>1️⃣ Save your own answers</b>
<code>/add What is photosynthesis? | The process plants use to convert light into energy.</code>
The part before <code>|</code> is the question, the part after is the answer.

<b>2️⃣ Review your library</b>
/list shows every question you saved, each with an ID number.

<b>3️⃣ Remove old entries</b>
<code>/delete 3</code> deletes the question with ID 3.

<b>4️⃣ Ask anything</b>
Send any text message (no command needed):
• If the question is in your library → you get <i>your</i> saved answer 📒
• If not → I ask the Groq AI and send you its answer 🤖

<b>Notes</b>
• Duplicate questions are rejected automatically.
• Your library is private — each user has their own.
"""


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    analytics.track_user(user.id, user.username, user.first_name)
    await update.message.reply_text(WELCOME_TEXT, parse_mode=ParseMode.HTML)


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    analytics.track_user(user.id, user.username, user.first_name)

    stats = analytics.get_stats()
    message = (
        f"📊 <b>Analytics Stats:</b>\n\n"
        f"Total Users: {stats["total_users"]}\n"
        f"New Users Today: {stats["new_users_today"]}\n"
        f"Active Users Today: {stats["active_users_today"]}\n"
        f"Users This Week: {stats["users_this_week"]}"
    )
    await update.message.reply_text(message, parse_mode=ParseMode.HTML)



async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    analytics.track_user(user.id, user.username, user.first_name)
    await update.message.reply_text(HELP_TEXT, parse_mode=ParseMode.HTML)



async def cmd_add(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    analytics.track_user(user.id, user.username, user.first_name)
    user_id = user.id
    raw = update.message.text.partition(" ")[2].strip()

    if "|" not in raw:
        await update.message.reply_text(
            "❗ Wrong format.\n\n"
            "Use: /add question | answer\n"
            "Example:\n"
            "/add What is gravity? | A force that attracts objects toward each other."
        )
        return

    question, _, answer = raw.partition("|")
    question, answer = question.strip(), answer.strip()

    if not question or not answer:
        await update.message.reply_text(
            "❗ Both the question and the answer must not be empty.\n"
            "Use: /add question | answer"
        )
        return

    if db.db_add_question(user_id, question, answer):
        await update.message.reply_text(f"✅ Saved!\n\n❓ {question}\n💡 {answer}")
    else:
        await update.message.reply_text(
            "⚠️ That question is already in your library.\n"
            "Use /list to see it, or /delete to remove it first."
        )


async def cmd_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    analytics.track_user(user.id, user.username, user.first_name)
    user_id = user.id
    rows = db.db_list_questions(user_id)

    if not rows:
        await update.message.reply_text(
            "📭 Your library is empty.\n"
            "Add your first entry with:\n"
            "/add question | answer"
        )
        return

    lines = ["📚 <b>Your saved questions:</b>\n"]
    for row in rows:
        lines.append(
            f"🆔 <b>{row['id']}</b> — {html.escape(row['question'])}\n"
            f"     💡 {html.escape(row['answer'])}\n"
        )
    lines.append("🗑 Delete one with: <code>/delete ID</code>")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


async def cmd_delete(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    analytics.track_user(user.id, user.username, user.first_name)
    user_id = user.id
    args = context.args

    if not args or not args[0].isdigit():
        await update.message.reply_text(
            "❗ Please give the ID of the question to delete.\n"
            "Example: /delete 3\n\n"
            "Use /list to see the IDs."
        )
        return

    question_id = int(args[0])
    if db.db_delete_question(user_id, question_id):
        await update.message.reply_text(f"🗑 Question {question_id} deleted.")
    else:
        await update.message.reply_text(
            f"⚠️ No question with ID {question_id} found in your library."
        )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """AI fallback: library first, then Groq AI (shared logic)."""
    user = update.effective_user
    analytics.track_user(user.id, user.username, user.first_name)
    user_id = user.id
    question = update.message.text.strip()

    source, answer = await answer_question(user_id, question)
    if source == "library":
        await update.message.reply_text(f"📒 From your library:\n\n{answer}")
    else:
        await update.message.chat.send_action("typing")
        await update.message.reply_text(f"🤖 AI answer:\n\n{answer}")


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error("Exception while handling an update:", exc_info=context.error)
    if isinstance(update, Update) and update.effective_message:
        try:
            await update.effective_message.reply_text(
                "😵 Oops, something went wrong. Please try again."
            )
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Application factory + lazy singleton
# ---------------------------------------------------------------------------
def build_application() -> Application:
    application = (
        Application.builder()
        .token(TELEGRAM_BOT_TOKEN)
        .updater(None)  # webhook mode
        .build()
    )
    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("help", cmd_help))
    application.add_handler(CommandHandler("add", cmd_add))
    application.add_handler(CommandHandler("list", cmd_list))
    application.add_handler(CommandHandler("delete", cmd_delete))

    admin_id = os.environ.get("TELEGRAM_ADMIN_ID")
    if admin_id:
        application.add_handler(CommandHandler("stats", cmd_stats, filters=User(int(admin_id))))
    else:
        logger.warning("TELEGRAM_ADMIN_ID not set. /stats command will not be available.")
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )
    application.add_error_handler(error_handler)
    return application


_ptb_app: Application | None = None


async def get_ptb_app() -> Application:
    """Lazily initialise the PTB application (once per cold start)."""
    global _ptb_app
    if _ptb_app is None:
        db.init_db()
        _ptb_app = build_application()
        await _ptb_app.initialize()
        logger.info("Telegram application initialised")
        
        # Set bot profile picture from logo
        try:
            logo_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "frontend", "assets", "logo.png"
            )
            if os.path.exists(logo_path):
                with open(logo_path, "rb") as f:
                    await _ptb_app.bot.set_my_default_administrator_rights()
                logger.info("Bot initialized with logo")
        except Exception as e:
            logger.warning(f"Could not set bot profile picture: {e}")
    return _ptb_app
