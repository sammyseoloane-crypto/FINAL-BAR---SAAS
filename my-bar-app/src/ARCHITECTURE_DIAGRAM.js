/*
 * MULTI-TENANT ARCHITECTURE - VISUAL DIAGRAM
 * ==========================================
 *
 * DATABASE STRUCTURE:
 *
 *     ┌─────────────────┐
 *     │    tenants      │
 *     │  (Bar Biz Info) │
 *     └────────┬────────┘
 *              │
 *      ┌───────┴───────┬─────────────┬──────────────┬──────────────┬──────────────┐
 *      │               │             │              │              │              │
 *  ┌───▼────┐   ┌──────▼──────┐  ┌──▼───────┐  ┌──▼───────┐  ┌──▼──────┐  ┌────▼─────┐
 *  │ users  │   │  locations  │  │ products │  │  events  │  │  tasks  │  │transactions│
 *  │tenant_id│  │  tenant_id  │  │tenant_id │  │tenant_id │  │tenant_id│  │ tenant_id  │
 *  └────────┘   └─────────────┘  └──────────┘  └──────────┘  └─────────┘  └────────────┘
 *
 *
 * USER FLOW:
 *
 *  ┌─────────────────────────────────────────┐
 *  │  1. OWNER REGISTRATION                  │
 *  │  "Register as owner with business name" │
 *  └────────────────┬────────────────────────┘
 *                   │
 *                   ▼
 *  ┌─────────────────────────────────────────┐
 *  │  2. TENANT CREATION                     │
 *  │  New tenant created in `tenants` table  │
 *  │  - name: "Bar A"                        │
 *  │  - subscription: "trial"                │
 *  │  - subscription_end: +14 days           │
 *  └────────────────┬────────────────────────┘
 *                   │
 *                   ▼
 *  ┌─────────────────────────────────────────┐
 *  │  3. USER PROFILE CREATION               │
 *  │  User linked to tenant                  │
 *  │  - tenant_id: [new tenant]              │
 *  │  - role: "owner"                        │
 *  └────────────────┬────────────────────────┘
 *                   │
 *                   ▼
 *  ┌─────────────────────────────────────────┐
 *  │  4. LOGIN & CONTEXT                     │
 *  │  userProfile.tenant_id available        │
 *  │  All queries use this tenant_id         │
 *  └─────────────────────────────────────────┘
 *
 *
 * DATA ISOLATION:
 *
 *   TENANT A                          TENANT B
 *   ┌──────────┐                      ┌──────────┐
 *   │ Bar A    │                      │ Bar B    │
 *   │ (ID: 1)  │                      │ (ID: 2)  │
 *   └────┬─────┘                      └────┬─────┘
 *        │                                 │
 *   ┌────▼─────────┐                 ┌────▼─────────┐
 *   │ Products:    │                 │ Products:    │
 *   │ - Beer A     │                 │ - Wine B     │
 *   │ - Food A     │                 │ - Food B     │
 *   │ (tenant_id=1)│                 │ (tenant_id=2)│
 *   └──────────────┘                 └──────────────┘
 *        │                                 │
 *   ┌────▼─────────┐                 ┌────▼─────────┐
 *   │ Events:      │                 │ Events:      │
 *   │ - Party A    │                 │ - Jazz B     │
 *   │ (tenant_id=1)│                 │ (tenant_id=2)│
 *   └──────────────┘                 └──────────────┘
 *        │                                 │
 *   ┌────▼─────────┐                 ┌────▼─────────┐
 *   │ Staff:       │                 │ Staff:       │
 *   │ - Staff A1   │                 │ - Staff B1   │
 *   │ - Staff A2   │                 │ - Staff B2   │
 *   │ (tenant_id=1)│                 │ (tenant_id=2)│
 *   └──────────────┘                 └──────────────┘
 *
 *   ❌ Staff A1 CANNOT see Staff B1 tasks
 *   ❌ Owner A CANNOT see Bar B products
 *   ❌ Customer A CANNOT see Customer B transactions
 *
 *
 * SECURITY LAYERS:
 *
 *   ┌─────────────────────────────────────────┐
 *   │  LAYER 1: PostgreSQL RLS (Primary)      │
 *   │  Database automatically filters all     │
 *   │  queries by user's tenant_id            │
 *   └─────────────────────────────────────────┘
 *                    ▲
 *                    │
 *   ┌─────────────────────────────────────────┐
 *   │  LAYER 2: Application Queries           │
 *   │  All queries explicitly include:        │
 *   │  .eq('tenant_id', userProfile.tenant_id)│
 *   └─────────────────────────────────────────┘
 *                    ▲
 *                    │
 *   ┌─────────────────────────────────────────┐
 *   │  LAYER 3: Context Validation            │
 *   │  userProfile.tenant_id from database    │
 *   │  Cannot be manipulated by client        │
 *   └─────────────────────────────────────────┘
 *
 *
 * QUERY EXAMPLES:
 *
 *   // ✅ CORRECT - Explicit tenant filter
 *   const { data } = await supabase
 *     .from('products')
 *     .select('*')
 *     .eq('tenant_id', userProfile.tenant_id)  // Security!
 *
 *   // ✅ CORRECT - Insert with tenant_id
 *   const { data } = await supabase
 *     .from('products')
 *     .insert([{
 *       name: 'Beer',
 *       price: 30,
 *       tenant_id: userProfile.tenant_id  // Required!
 *     }])
 *
 *   // ❌ WRONG - Missing tenant_id filter
 *   const { data } = await supabase
 *     .from('products')
 *     .select('*')
 *     // Missing tenant filter - Data leak risk!
 *
 *
 * ROLE-BASED ACCESS:
 *
 *   OWNER/ADMIN:
 *   - Can see ALL tenant data
 *   - Can create/update/delete tenant resources
 *   - Query: WHERE tenant_id = user.tenant_id
 *
 *   STAFF:
 *   - Can see ASSIGNED tasks only
 *   - Can view tenant products/events (read-only)
 *   - Query: WHERE tenant_id = user.tenant_id AND assigned_to = user.id
 *
 *   CUSTOMER:
 *   - Can see OWN transactions only
 *   - Can view tenant products/events (read-only)
 *   - Query: WHERE tenant_id = user.tenant_id AND user_id = user.id
 *
 *
 * TESTING SCENARIOS:
 *
 *   Scenario 1: Create 2 owners → 2 separate tenants
 *   Scenario 2: Each owner adds products → No cross-visibility
 *   Scenario 3: Staff joins tenant → Sees only that tenant's data
 *   Scenario 4: Customer registers → Assigned to selected tenant
 *   Scenario 5: RLS test → Direct API access blocked for other tenants
 *
 *
 * FILES REFERENCE:
 *
 *   Database:
 *   - supabase/migrations/20260217000000_initial_schema.sql
 *
 *   Authentication:
 *   - src/contexts/AuthContext.jsx (tenant creation logic)
 *   - src/pages/Register.jsx (tenant selection UI)
 *
 *   Utilities:
 *   - src/utils/tenantUtils.js (helper functions)
 *
 *   Debugging:
 *   - src/components/TenantDebugPanel.jsx (dev tool)
 *
 *   Documentation:
 *   - MULTI_TENANT_GUIDE.md (architecture)
 *   - TESTING_GUIDE.md (test scenarios)
 *   - MULTI_TENANT_SUMMARY.md (implementation details)
 *
 *
 * REMEMBER:
 *
 *   🔒 Always filter by tenant_id
 *   🔒 Never trust tenant_id from client
 *   🔒 Use userProfile.tenant_id from auth context
 *   🔒 Test with multiple tenants
 *   🔒 Verify RLS policies are enabled
 *
 */
