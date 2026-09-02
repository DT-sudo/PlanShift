from django.urls import path

from . import views

urlpatterns = [
    path("users/<int:user_id>/", views.profile, name="profile"),
    path("settings/", views.account_settings, name="account_settings"),
    path("friends/", views.friends, name="friends"),
]
