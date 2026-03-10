## Packages
framer-motion | For smooth page transitions, layout animations, and beautiful micro-interactions.
date-fns | For reliable date parsing and formatting logic matching the original HTML functionality.
lucide-react | For stunning, consistent iconography across the application.

## Notes
The application expects the backend API to be available exactly as defined in the routes manifest.
Settings endpoint must return a valid object (even if defaults) to prevent Math calculation errors.
Numeric values in the database schema (Drizzle `numeric`) are transmitted as strings in JSON. The frontend handles parsing these to `Number` for all derived calculations, and formatting them back to strings for API submissions.
