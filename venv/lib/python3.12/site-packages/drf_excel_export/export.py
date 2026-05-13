import logging
import yaml  
from openpyxl import Workbook
import django
from django.conf import settings
from drf_spectacular.generators import SchemaGenerator  # Import for drf-spectacular



# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_schema_from_file(file_path):
    """Loads a schema from a YAML or JSON file."""
    with open(file_path, 'r') as f:
        schema = yaml.safe_load(f)
    return schema


# Minimal Django settings configuration
if not settings.configured:
    settings.configure(
        INSTALLED_APPS=[
            "rest_framework",
            "drf_spectacular",
            "drf_yasg",
        ],
        REST_FRAMEWORK={},
    )
    django.setup()


try:
    from drf_spectacular.openapi import AutoSchema as SpectacularSchema
    spectacular_available = True
except ImportError:
    spectacular_available = False

# Try to import drf-yasg
try:
    from drf_yasg.openapi import Info, Schema
    from drf_yasg.generators import OpenAPISchemaGenerator
    yasg_available = True
except ImportError:
    yasg_available = False


def generate_api_schema():
    """
    Generates the OpenAPI schema for the DRF API using drf-spectacular or drf-yasg.
    """
    if spectacular_available:
        # Use SchemaGenerator for drf-spectacular to get the schema as a dictionary
        generator = SchemaGenerator()
        schema = generator.get_schema(request=None, public=True)
        logger.info("Using drf-spectacular to generate the schema.")
    elif yasg_available:
        # Use OpenAPISchemaGenerator for drf-yasg to get the schema as a dictionary
        generator = OpenAPISchemaGenerator(
            info=Info(
                title="API Documentation",
                default_version="v1",
            )
        )
        schema = generator.get_schema(request=None, public=True)
        logger.info("Using drf-yasg to generate the schema.")
    else:
        # If neither library is available, raise an error
        logger.error("Neither drf-spectacular nor drf-yasg is installed. Please install one to generate the schema.")
        raise ImportError("Neither drf-spectacular nor drf-yasg is installed. Please install one to generate the schema.")
    
    return schema


def export_to_excel(schema):
    """
    Exports the API schema to an Excel file, compatible with drf-spectacular and drf-yasg.
    """
    # Create a new Excel workbook and set up the main sheet
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "API Documentation"
    
    # Define headers for the Excel file
    headers = ["Endpoint", "Method", "Description", "Parameters", "Response Codes"]
    sheet.append(headers)

    # Assuming the schema is now a dictionary, check for 'paths'
    try:
        paths = schema.get('paths', {})
        for path, path_item in paths.items():
            for method, operation in path_item.items():
                description = operation.get('description', '')
                parameters = [param['name'] for param in operation.get('parameters', [])]
                responses = list(operation.get('responses', {}).keys())

                # Append row to the Excel sheet
                sheet.append([
                    path,
                    method.upper(),
                    description,
                    ", ".join(parameters),
                    ", ".join(responses)
                ])

        # Save the Excel file
        workbook.save("api_documentation.xlsx")
        logger.info("Export complete: 'api_documentation.xlsx'")
    except Exception as e:
        logger.error(f"An error occurred during export: {e}")
        raise e



