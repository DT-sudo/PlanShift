from django.urls import path

from . import views

urlpatterns = [
    path("users/<int:user_id>/", views.profile, name="profile"),
    path("friends/", views.friends, name="friends"),
]
