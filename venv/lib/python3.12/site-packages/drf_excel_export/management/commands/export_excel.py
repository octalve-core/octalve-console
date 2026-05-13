from django.core.management.base import BaseCommand
from drf_excel_export.export import generate_api_schema, export_to_excel

class Command(BaseCommand):
    help = 'Exports the Django REST Framework API documentation to an Excel file.'

    def handle(self, *args, **options):
        try:
            # Generate the API schema
            schema = generate_api_schema()
            
            # Export schema to Excel
            export_to_excel(schema)
            
            self.stdout.write(self.style.SUCCESS("Successfully exported API documentation to 'api_documentation.xlsx'"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"An error occurred: {e}"))
