from django.urls import path

from . import views

urlpatterns = [
    path("manager/shifts/", views.manager_shifts, name="manager_shifts"),
    path("manager/shifts/create/", views.save_shift_view, name="create_shift"),
    path("manager/shifts/<int:shift_id>/update/", views.save_shift_view, name="update_shift"),
    path("manager/shifts/<int:shift_id>/delete/", views.delete_shift, name="delete_shift"),
]
