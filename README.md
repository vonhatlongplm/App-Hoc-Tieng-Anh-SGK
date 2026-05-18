# Aptis ESOL B2 Master Tutor - AI Powered

This is an AI-powered web application designed to help students prepare for the Aptis ESOL B2 exam. It features a personalized learning roadmap, AI-driven feedback, and cloud synchronization for user progress.

## Deployment

This application is designed to be deployed on a platform like **Vercel** or **Netlify**.

### 1. Supabase Setup (Database)

1.  Create a new project on [Supabase](https://supabase.com/).
2.  Go to the **SQL Editor**.
3.  Run the following query to create the necessary table for storing user profiles:

    ```sql
    CREATE TABLE profiles (
      user_id TEXT PRIMARY KEY,
      profile_data JSONB,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ```

### 2. Environment Variables

When deploying your application (e.g., on Vercel), you need to configure the following environment variables to connect to your Supabase project.

1.  Go to your Supabase project's **Settings > API**.
2.  Find your **Project URL** and the **`anon` `public` API Key**.
3.  Set them as environment variables in your deployment platform:

    -   `SUPABASE_URL`: Your Supabase Project URL.
    -   `SUPABASE_ANON_KEY`: Your Supabase `anon` `public` API Key.
    -   `API_KEY`: Your Google AI (Gemini) API Key.

After setting these up, your application will be able to connect to the database to save and load student progress, and the teacher dashboard will function correctly.
