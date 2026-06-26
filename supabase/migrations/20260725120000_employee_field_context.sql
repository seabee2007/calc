-- Employee field profile: job title + secure employer context for Field Portal

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text;

CREATE OR REPLACE FUNCTION public.get_employee_field_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile profiles%ROWTYPE;
  v_employer profiles%ROWTYPE;
  v_company company_settings%ROWTYPE;
  v_employer_email text;
  v_project_count integer := 0;
  v_task_count integer := 0;
  v_project_names jsonb := '[]'::jsonb;
  v_removed boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF NOT FOUND OR v_profile.employer_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_profile.role NOT IN ('employee', 'foreman', 'project_manager') THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM employee_workspace_removals ewr
    WHERE ewr.employee_user_id = v_user_id
      AND ewr.workspace_id = v_profile.employer_id
  ) INTO v_removed;

  SELECT * INTO v_employer FROM profiles WHERE id = v_profile.employer_id;

  SELECT * INTO v_company
  FROM company_settings
  WHERE user_id = v_profile.employer_id;

  SELECT email INTO v_employer_email
  FROM auth.users
  WHERE id = v_profile.employer_id;

  SELECT count(*)::integer INTO v_project_count
  FROM employee_project_assignments
  WHERE employee_id = v_user_id;

  SELECT count(DISTINCT t.id)::integer INTO v_task_count
  FROM planner_tasks t
  WHERE t.status IS DISTINCT FROM 'Completed'
    AND (
      t.assigned_to = v_user_id
      OR EXISTS (
        SELECT 1
        FROM planner_task_assignees a
        WHERE a.task_id = t.id
          AND a.user_id = v_user_id
      )
    );

  SELECT coalesce(jsonb_agg(sub.name ORDER BY sub.name), '[]'::jsonb)
  INTO v_project_names
  FROM (
    SELECT pr.name
    FROM employee_project_assignments epa
    JOIN projects pr ON pr.id = epa.project_id
    WHERE epa.employee_id = v_user_id
    ORDER BY pr.name
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'role', v_profile.role,
      'employerId', v_profile.employer_id,
      'displayName', v_profile.display_name,
      'firstName', v_profile.first_name,
      'lastName', v_profile.last_name,
      'phone', v_profile.phone,
      'jobTitle', v_profile.job_title,
      'onboardingCompletedAt', v_profile.onboarding_completed_at
    ),
    'company', jsonb_build_object(
      'companyName', coalesce(v_company.company_name, ''),
      'address', coalesce(v_company.address, ''),
      'phone', coalesce(v_company.phone, ''),
      'email', coalesce(v_company.email, ''),
      'logoUrl', v_company.logo_url
    ),
    'employerContact', jsonb_build_object(
      'displayName', v_employer.display_name,
      'phone', v_employer.phone,
      'email', v_employer_email
    ),
    'membership', jsonb_build_object(
      'role', v_profile.role,
      'status', CASE WHEN v_removed THEN 'removed' ELSE 'active' END
    ),
    'assignments', jsonb_build_object(
      'projectCount', v_project_count,
      'taskCount', v_task_count,
      'projectNames', v_project_names
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_field_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_field_context() TO authenticated;
