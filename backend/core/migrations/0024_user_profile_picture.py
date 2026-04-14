from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0023_razorpayxpayoutwebhookevent_alter_review_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="profile_picture",
            field=models.ImageField(blank=True, null=True, upload_to="profile-pictures/"),
        ),
    ]
