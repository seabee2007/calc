/*
  # Add subscription tables and functionality

  1. New Tables
    - `subscriptions`
      - Stores user subscription information
      - Links to Stripe customer and subscription IDs
    - `subscription_tiers`
      - Defines available subscription tiers
      - Includes features and limits

  2. Security
    - Enable RLS on new tables
    - Add policies for authenticated users
*/

-- Create subscription tiers table
CREATE TABLE subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_id text NOT NULL,
  features jsonb NOT NULL,
  limits jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier_id uuid REFERENCES subscription_tiers(id) NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read subscription tiers"
  ON subscription_tiers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read own subscription"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insert subscription tiers
INSERT INTO subscription_tiers (name, description, price_id, features, limits)
VALUES
  (
    'Free',
    'Basic concrete calculations',
    'price_free',
    '["Basic calculations", "Weather data"]'::jsonb,
    '{"projects": 1, "calculations_per_month": 10}'::jsonb
  ),
  (
    'Pro',
    'Advanced features for professionals',
    'price_pro_monthly',
    '["Unlimited calculations", "Advanced mix designs", "Priority support", "Custom recommendations"]'::jsonb,
    '{"projects": 50, "calculations_per_month": -1}'::jsonb
  ),
  (
    'Business',
    'Enterprise-level concrete management',
    'price_business_monthly',
    '["Everything in Pro", "Team collaboration", "API access", "Custom reporting"]'::jsonb,
    '{"projects": -1, "calculations_per_month": -1}'::jsonb
  );