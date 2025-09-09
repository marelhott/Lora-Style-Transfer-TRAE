#!/usr/bin/env python3
"""
Standalone script pro zpracování obrázků
Volá se z Next.js API
"""

import sys
import json
import asyncio
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from ai_processor import AIProcessor

async def main():
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Usage: python3 process_image.py <image_path> <model_id> <parameters_json>"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    model_id = sys.argv[2]
    parameters_json = sys.argv[3]
    
    try:
        # Parse parameters
        parameters = json.loads(parameters_json)
        
        # Initialize AI processor
        processor = AIProcessor()
        
        # Read image
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        # Process image
        result = await processor.process_image(image_data, model_id, parameters)
        
        # Output result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
