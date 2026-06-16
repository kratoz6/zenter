-- Lets a logged-in user claim Zenter Plus when their final price is ₹0 (coupon covers full cost).
-- SECURITY DEFINER so the function can bypass RLS and write plus_member.
-- auth.uid() = p_user_id prevents any user from granting Plus to a different account.
CREATE OR REPLACE FUNCTION claim_free_plus(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE users SET plus_member = true WHERE id = p_user_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_free_plus(uuid) TO authenticated;
