# ali-a
import os
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

TELEGRAM_TOKEN = 8817790187:AAFQI-ThAsC7ZHLUUywEM7uOObEe4VeXFR4os.environ.get("TELEGRAM_TOKEN")
OPENROUTER_API_KEY = sk-or-v1-e40c1098b5626981025479a443efab914d406097591ce4f449a235e0d1d9863aos.environ.get("OPENROUTER_API_KEY")
APP_URL = os.environ.get("APP_URL")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET")

TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"
OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """
تو ENGINEERING AI هستی؛ دستیار تخصصی مهندسی.
در زمینه‌های زیر به کاربر کمک کن:
- الکترونیک و تعمیر برد
- قطعات و مدارهای الکترونیکی
- برنامه‌نویسی Python و C++
- برق و کامپیوتر
- ریاضیات و مبانی دیجیتال

پاسخ‌ها را دقیق، کاربردی و به زبان فارسی ارائه بده.
اگر اطلاعات کافی نداری، سؤال تکمیلی بپرس.
"""


def telegram_request(method, data):
    response = requests.post(
        f"{TELEGRAM_API}/{method}",
        json=data,
        timeout=30
    )
    response.raise_for_status()
    return response.json()


def send_message(chat_id, text):
    max_length = 4000

    for start in range(0, len(text), max_length):
        telegram_request(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": text[start:start + max_length]
            }
        )


def ask_ai(question):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "openrouter/free",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question}
        ]
    }

    response = requests.post(
        OPENROUTER_API,
        headers=headers,
        json=payload,
        timeout=90
    )

    response.raise_for_status()
    result = response.json()

    return result["choices"][0]["message"]["content"]


@app.route("/", methods=["GET"])
def home():
    return "ENGINEERING AI is running!", 200


@app.route("/telegram-webhook/" + (os.environ.get("WEBHOOK_SECRET") or "missing"),
           methods=["POST"])
def telegram_webhook():
    update = request.get_json(silent=True) or {}

    message = update.get("message", {})
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    text = message.get("text", "")

    if not chat_id or not text:
        return jsonify({"ok": True})

    if text == "/start":
        send_message(
            chat_id,
            "سلام! ⚡\n"
            "به ENGINEERING AI خوش آمدی.\n\n"
            "سؤال خودت را درباره الکترونیک، تعمیر برد، "
            "برنامه‌نویسی یا ریاضی بپرس."
        )
        return jsonify({"ok": True})

    if text == "/help":
        send_message(
            chat_id,
            "راهنمای ENGINEERING AI\n\n"
            "سؤالت را به‌صورت پیام متنی ارسال کن.\n"
            "می‌توانی درباره الکترونیک، برنامه‌نویسی و ریاضی بپرسی."
        )
        return jsonify({"ok": True})

    try:
        answer = ask_ai(text)

        if not answer:
            answer = "پاسخی دریافت نشد؛ لطفاً دوباره تلاش کن."

        send_message(chat_id, answer)

    except requests.RequestException:
        send_message(
            chat_id,
            "ارتباط با سرویس هوش مصنوعی برقرار نشد. "
            "کمی بعد دوباره تلاش کن."
        )

    except Exception:
        send_message(
            chat_id,
            "خطایی رخ داد. لطفاً دوباره تلاش کن."
        )

    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))

    if not TELEGRAM_TOKEN or not OPENROUTER_API_KEY:
        raise RuntimeError(
            "TELEGRAM_TOKEN and OPENROUTER_API_KEY must be configured."
        )

    if not APP_URL or not WEBHOOK_SECRET:
        raise RuntimeError(
            "APP_URL and WEBHOOK_SECRET must be configured."
        )

    webhook_url = (
        APP_URL.rstrip("/")
        + "/telegram-webhook/"
        + WEBHOOK_SECRET
    )

    result = telegram_request(
        "setWebhook",
        {"url": webhook_url}
    )

    if not result.get("ok"):
        raise RuntimeError("Telegram webhook setup failed.")

    app.run(host="0.0.0.0", port=port)
