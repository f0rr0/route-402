-- Custom SQL migration file, put your code below! --

-- Seed dev org/project and membership rows for the existing user.
-- User ID: 2fbf6476-97a9-4eeb-b785-41f354af392e
-- Password for credential account: route402dev
INSERT INTO orgs (id, name, created_at)
VALUES ('1e60d419-e30e-4b14-9c57-31b88298701b', 'Route402 Dev', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, org_id, name, created_at)
VALUES (
  'ef89a7bc-a941-4219-816e-a36dc3c99458',
  '1e60d419-e30e-4b14-9c57-31b88298701b',
  'Default',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO org_members (org_id, user_id, role, created_at)
SELECT '1e60d419-e30e-4b14-9c57-31b88298701b', '2fbf6476-97a9-4eeb-b785-41f354af392e', 'owner', now()
WHERE EXISTS (SELECT 1 FROM users WHERE id = '2fbf6476-97a9-4eeb-b785-41f354af392e')
ON CONFLICT DO NOTHING;

INSERT INTO project_members (project_id, user_id, role, created_at)
SELECT 'ef89a7bc-a941-4219-816e-a36dc3c99458', '2fbf6476-97a9-4eeb-b785-41f354af392e', 'owner', now()
WHERE EXISTS (SELECT 1 FROM users WHERE id = '2fbf6476-97a9-4eeb-b785-41f354af392e')
ON CONFLICT DO NOTHING;

INSERT INTO account (account_id, provider_id, user_id, password)
SELECT
  '2fbf6476-97a9-4eeb-b785-41f354af392e',
  'credential',
  '2fbf6476-97a9-4eeb-b785-41f354af392e',
  'c51cc57de43b577fd750ae7e44a46d74:96e4875359baf49cb3f83b46b057b26a136595da54bf6c2f7b002df45a722687132aeb2382bfe4d1737c24473bb68eab61b2b485b4f1617e909d9545cab68f7d'
WHERE EXISTS (SELECT 1 FROM users WHERE id = '2fbf6476-97a9-4eeb-b785-41f354af392e')
  AND NOT EXISTS (
    SELECT 1
    FROM account
    WHERE user_id = '2fbf6476-97a9-4eeb-b785-41f354af392e'
      AND provider_id = 'credential'
  );
