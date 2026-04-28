# Notion Milestones Widget

A small GitHub Pages widget for Notion. It shows each Milestone with:

- progress through the milestone timeline
- days left until the deadline
- project subtitle
- each related Project page icon

The private Notion API token is only used inside GitHub Actions. The widget page reads `data/milestones.json`, which contains only the public values needed for display.

## Notion Setup

1. Create a Notion integration at <https://www.notion.so/my-integrations>.
2. Give it read access.
3. Open your Milestones database in Notion, then add the integration as a connection.
4. Make sure your Milestones database has these properties, or adjust the GitHub variables below:

| Purpose | Default property name | Supported property type |
| --- | --- | --- |
| Milestone title | `Name` | Title |
| Project subtitle/icon | `Project`, `Projects`, or `Portfolio` | Relation preferred; Select, Status, Text, Formula, or Rollup also supported for text |
| Date range | `Dates` | Date range |
| Start date fallback | `Start` | Date or formula returning date |
| End date fallback | `End` | Date or formula returning date |

If your milestone has one date range property, use `Dates`. If it has separate start and end properties, leave `Dates` unset in GitHub and set `Start` / `End` to your actual property names.
The widget calculates progress from the milestone start and end dates.

## GitHub Setup

1. Create a new GitHub repository and upload these files.
2. In the repository, go to **Settings -> Secrets and variables -> Actions**.
3. Add this repository secret:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `NOTION_TOKEN` | Your Notion integration secret |

4. Add either of these repository variables:

| Type | Name | Value |
| --- | --- | --- |
| Variable | `NOTION_MILESTONES_DATA_SOURCE_ID` | Preferred current Notion data source ID |
| Variable | `NOTION_MILESTONES_DATABASE_ID` | Alternative database ID; the workflow uses its first data source |

5. Add these variables only if your property names differ from the defaults:

| Name | Default |
| --- | --- |
| `NOTION_MILESTONE_TITLE_PROPERTY` | `Name` |
| `NOTION_MILESTONE_PROJECT_PROPERTY` | ` 🏰 Project,Projects,Portfolio` |
| `NOTION_MILESTONE_DATE_PROPERTY` | `Dates` |
| `NOTION_MILESTONE_START_PROPERTY` | `Start` |
| `NOTION_MILESTONE_END_PROPERTY` | `End` |

6. Go to **Settings -> Pages** and set **Source** to **GitHub Actions**.
7. Run **Actions -> Update Notion widget -> Run workflow**.
8. Copy the Pages URL and paste it into Notion with `/embed`.

## Local Preview

The widget can be previewed locally by opening `index.html` or serving this folder with any static file server. Until real Notion data is fetched, it will show the empty state from `data/milestones.json`.

## Notes

- The workflow refreshes every 6 hours and can also be run manually.
- Timeline progress is calculated as today between start date and end date, clamped from `0%` to `100%`.
- The small label below each progress bar shows days left until the end date, or overdue status when the date has passed.
- The icon on the left uses the related Project page icon from Notion when `Project` is a relation. Emoji and external image icons are stable; Notion file icons are refreshed by the scheduled workflow.
- If your relation has a different name, set `NOTION_MILESTONE_PROJECT_PROPERTY` to the exact property name. You can also provide a comma-separated list of names to try.
