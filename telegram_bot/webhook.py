from telegram import Update
from telegram_bot.bot import get_ptb_app
import asyncio

async def handler(request):
    if request.method != "POST":
        return {"statusCode": 200, "body": "OK"}

    app = await get_ptb_app()

    data = await request.json()

    update = Update.de_json(data, app.bot)

    await app.process_update(update)

    return {"statusCode": 200, "body": "OK"}


def main(request):
    return asyncio.run(handler(request))
