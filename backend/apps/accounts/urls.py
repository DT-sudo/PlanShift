from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("login/", views.login_view, name="login"),
    path("signup/", views.signup_view, name="signup"),
    path("logout/", views.logout_view, name="logout"),
    path("pending/", views.registration_pending, name="registration_pending"),
    path("login/demo/<str:role>/", views.demo_login, name="demo_login"),
    path("admin/users/", views.admin_users, name="admin_users"),
    path("admin/users/create/", views.admin_user_create, name="admin_user_create"),
    path("admin/users/<int:user_id>/update/", views.admin_user_update, name="admin_user_update"),
    path("admin/users/<int:user_id>/reset-password/", views.admin_user_reset_password, name="admin_user_reset_password"),
    path("admin/users/<int:user_id>/reset-2fa/", views.admin_user_reset_two_factor, name="admin_user_reset_two_factor"),
    path("admin/users/<int:user_id>/delete/", views.admin_user_delete, name="admin_user_delete"),
    path("admin/requests/", views.registration_requests, name="registration_requests"),
    path("admin/requests/<int:user_id>/approve/", views.registration_approve, name="registration_approve"),
    path("admin/requests/<int:user_id>/decline/", views.registration_decline, name="registration_decline"),
    path("admin/positions/create/", views.position_create, name="position_create"),
    path("admin/positions/<int:position_id>/delete/", views.position_delete, name="position_delete"),
]
