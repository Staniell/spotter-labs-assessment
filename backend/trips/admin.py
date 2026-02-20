from django.contrib import admin

from .models import DailySheet, Segment, Stop, TripPlan

admin.site.register(TripPlan)
admin.site.register(Stop)
admin.site.register(DailySheet)
admin.site.register(Segment)
