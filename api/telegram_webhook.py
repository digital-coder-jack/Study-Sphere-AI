import asyncio
from telegram import Update
from telegram_bot.bot import get_ptb_app

def handler(request):
    return asyncio.run(main(request))


async def main(request):
    if request.method != "POST":
        return {"statusCode": 200, "body": "OK"}

    app = await get_ptb_app()

    data = await request.json()

    update = Update.de_json(data, app.bot)

    await app.process_update(update)

    return {"statusCode": 200, "body": "OK"}
