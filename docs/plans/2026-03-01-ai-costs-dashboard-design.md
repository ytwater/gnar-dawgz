# AI Costs Dashboard Design
**Date**: March 1, 2026

## Overview
An admin dashboard that tracks, aggregates, and visualizes the costs associated with all AI features in the application. Currently covers AI Profile Image generation (Gemini/OpenAI) and chat analysis interactions (DeepSeek), with an extensible foundation for future AI integrations.

## Architecture

1.  **Cost Storage Table (`ai_usage_logs`)**:
    Transactions are stored immutably with their exact dollar cost *at the time of generation*. This prevents historical data from mutating when API pricing changes in the future.
2.  **Live Pricing Sync (`ai_models`)**:
    A Cloudflare Worker cron job runs daily to fetch live pricing from the [OpenRouter API](https://openrouter.ai/api/v1/models) to ensure token cost calculations remain accurate without manual intervention.
3.  **Default Provider**:
    Image generation defaults to **Gemini**. The system is built to handle other providers (like OpenAI) if changed.

## Database Schema (D1)

### `ai_models`
Stores the latest pricing metrics for supported AI models.

-   `id`: `text` (Primary Key, e.g., "google/gemini-1.5-pro", "deepseek/deepseek-chat")
-   `provider`: `text` (e.g., "google", "deepseek")
-   `prompt_price`: `real` (Cost per 1M tokens)
-   `completion_price`: `real` (Cost per 1M tokens)
-   `image_price`: `real` (Cost per image)
-   `updated_at`: `timestamp`

### `ai_usage_logs`
An append-only log of every individual AI action.

-   `id`: `text` (Primary Key)
-   `user_id`: `text` (Foreign Key -> `users.id`)
-   `model_id`: `text` (Foreign Key -> `ai_models.id`)
-   `feature`: `text` (e.g., "profile_creator", "waha_chat")
-   `prompt_tokens`: `integer` (Nullable)
-   `completion_tokens`: `integer` (Nullable)
-   `images_generated`: `integer` (Nullable)
-   `total_cost`: `real` (Calculated exact dollar amount at time of generation)
-   `created_at`: `timestamp`

## Admin Dashboard Structure

### 1. High-Level Dashboard (`/admin/costs`)
-   **KPI Cards**: Total AI Cost (All Time), Total AI Cost (This Month), Total Tokens Used, Total Images Generated.
-   **Visualizations**:
    -   Cost breakdown by feature (e.g., Chat vs Profile Creator).
    -   Cost breakdown by Provider/Model.
-   **User Leaderboard**: A data table showing users ranked by their total AI API cost, including their name, total cost, total images, and total chat actions.

### 2. User Drill-down (`/admin/costs/user/$userId`)
-   **Timeline Chart**: Visualizes the specific user's API costs over the last 30 days.
-   **Action Log**: A paginated, detailed ledger showing every individual action they took (e.g., `[Timestamp] Generated Profile Image - Gemini - $0.03`).

## Error Handling & Edge Cases
-   **OpenRouter API Failure**: If the daily cron job fails to fetch new prices, the system will gracefully fallback to the last known prices in the `ai_models` table without disrupting user features.
-   **Missing Pricing**: If an image generator isn't well-supported by OpenRouter's token pricing format, manual fallback configurations will be maintained in the database for those specific models.
