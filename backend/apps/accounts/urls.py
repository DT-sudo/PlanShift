from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("login/", views.login_view, name="login"),
    path("signup/", views.signup_view, name="signup"),
    path("logout/", views.logout_view, name="logout"),
    path("login/demo/<str:role>/", views.demo_login, name="demo_login"),
    path("admin/positions/create/", views.position_create, name="position_create"),
    path("admin/positions/<int:position_id>/delete/", views.position_delete, name="position_delete"),
]
