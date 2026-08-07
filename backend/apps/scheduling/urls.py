from django.urls import path

from . import views

urlpatterns = [
    path("manager/shifts/", views.manager_shifts, name="manager_shifts"),
]
