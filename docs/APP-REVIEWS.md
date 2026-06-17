# App Reviews

In-app owner feedback is stored in `public.app_reviews`. Submissions are processed by the `submit-app-review` edge function (service role). Clients may read their own rows via RLS; all writes go through the edge function.

## Schema

| Column | Description |
|--------|-------------|
| `id` | Primary key |
| `user_id` | Submitting user |
| `employer_id` | Billing company id (owner user id for company accounts) |
| `rating` | Integer 0–5 |
| `review_text` | Written feedback (20–2000 chars) |
| `public_consent` | Opt-in for future marketing use (default `false`) |
| `reviewer_name`, `reviewer_company`, `reviewer_role` | Optional display fields |
| `source` | Default `in_app` |
| `status` | `submitted`, `approved_for_marketing`, `rejected`, or `archived` |
| `reward_granted` | Whether usage credits were granted |
| `reward_granted_at` | Timestamp when credits were granted |
| `metadata` | JSON metadata |
| `created_at`, `updated_at` | Timestamps |

## Reward policy

- **25 `ai_request` credits** granted for any honest rating (0–5).
- Credits are inserted into `usage_credit_packs` with `metadata.source = 'review_reward'`.
- Credits expire at the **end of the current UTC calendar-month usage period** (same as purchased re-up packs).
- **One rewarded review per employer/account** (partial unique indexes enforce this).

## Public consent behavior

- `public_consent` defaults to `false`.
- Reviews are **never** published automatically.
- Marketing use requires:
  1. User checked the public consent checkbox at submission time.
  2. Manual admin update of `status` to `approved_for_marketing`.

## FTC / compliance note

Credits are granted for **honest feedback regardless of rating**. The product copy and server logic do not require or incentivize positive reviews.

## Admin extraction query

Approved reviews suitable for marketing export:

```sql
SELECT
  rating,
  review_text,
  reviewer_name,
  reviewer_company,
  reviewer_role,
  created_at
FROM public.app_reviews
WHERE public_consent = true
  AND status = 'approved_for_marketing'
ORDER BY created_at DESC;
```

To approve a review for marketing:

```sql
UPDATE public.app_reviews
SET status = 'approved_for_marketing', updated_at = now()
WHERE id = '<review-id>'
  AND public_consent = true;
```

## Related code

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260718000000_review_feedback_rewards.sql` | Table, indexes, RLS |
| `supabase/functions/submit-app-review/index.ts` | Auth, eligibility, reward grant |
| `src/services/appReviewService.ts` | Client fetch + submit |
| `src/hooks/useReviewRewardEligibility.ts` | Badge eligibility |
| `src/components/reviews/ReviewRewardBadge.tsx` | Dashboard pulse badge |
| `src/components/reviews/ReviewRewardModal.tsx` | Feedback form |
