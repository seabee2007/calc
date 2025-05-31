/*
  # Fix Proposals User Reference

  1. Changes
    - Drop the existing foreign key constraint that references custom users table
    - Update the user_id column to reference auth.users instead
    - Update the RLS policy to use auth.uid() correctly

  2. Security
    - Maintain RLS policies for user access control
*/

-- Drop the existing foreign key constraint
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_user_id_fkey;

-- Add new foreign key constraint referencing auth.users
ALTER TABLE proposals ADD CONSTRAINT proposals_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update the RLS policy to ensure it works correctly
DROP POLICY IF EXISTS "Users can manage own proposals" ON proposals;

CREATE POLICY "Users can manage own proposals"
  ON proposals
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid()); 