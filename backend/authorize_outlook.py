import sys

from dotenv import load_dotenv

load_dotenv()

from graph_auth import device_login  # noqa: E402

VALID_ACCOUNTS = ("outlook",)

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in VALID_ACCOUNTS:
        print(
            "Usage : python authorize_outlook.py outlook"
        )
        sys.exit(1)

    device_login(sys.argv[1])
