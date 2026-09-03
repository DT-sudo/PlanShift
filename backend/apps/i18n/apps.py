from django.apps import AppConfig


class I18nConfig(AppConfig):
    name = "apps.i18n"

    def ready(self) -> None:
        from . import signals
