-- Allow postgres (migration/ops) to SET ROLE into engine roles for maintenance and verification.
-- Application DSNs should still LOGIN as the specific engine role after passwords are set.

grant food_engine_app to postgres;
grant food_engine_worker to postgres;
grant food_engine_admin to postgres;
