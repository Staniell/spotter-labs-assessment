from django.urls import path

from . import views

urlpatterns = [
    path("plan", views.create_plan, name="create-plan"),
    path("plans", views.list_plans, name="list-plans"),
    path("plans/<uuid:plan_id>", views.get_plan, name="get-plan"),
]
