import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Permission from "../models/permission.model.js";
import Role from "../models/role.model.js";
import User from "../models/user.model.js";
import Organisation from "../models/organisation.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
// import AccessRule from "../models/accessRule.model.js"; // Not used in application

// Load environment variables
dotenv.config();

// =============================================================================
// CONFIGURATION - Modify these values to fit your needs
// =============================================================================

const SEED_CONFIG = {
  // Database Configuration
  DATABASE_URL: process.env.MONGODB_URI || "mongodb://localhost:27017/soc_dashboard",

  // Subscription Plans
  SUBSCRIPTION_PLANS: [
    {
      plan_name: "Tier 1",
      plan_code: "BASIC",
      plan_description: "Basic plan for small organizations",
      features: {
        alerts: true,
        tickets: true,
        users: true,
        compliance: true,
        reports: true,
        siem: true,
        threats: true,
        agents: true,
      },
      max_users: 1,
      max_assets: 25,
    },
    {
      plan_name: "Tier 2",
      plan_code: "PRO",
      plan_description: "Professional plan for medium organizations",
      features: {
        alerts: true,
        tickets: true,
        users: true,
        compliance: true,
        reports: true,
        siem: true,
        threats: true,
        agents: true,
        advanced_analytics: true,
      },
      max_users: 3,
      max_assets: 50,
    },
    {
      plan_name: "Tier 3",
      plan_code: "ENT",
      plan_description: "Enterprise plan for large organizations",
      features: {
        alerts: true,
        tickets: true,
        users: true,
        compliance: true,
        reports: true,
        siem: true,
        threats: true,
        agents: true,
        advanced_analytics: true,
        custom_integrations: true,
      },
      max_users: 5, // For Unlimited use -1
      max_assets: 100, // For Unlimited use -1
    },
  ],

  // Permissions Configuration
  PERMISSIONS: [
    // Overview & Dashboard
    {
      resource: "overview",
      action: "read",
      category: "dashboard",
      description: "View overview dashboard",
    },

    // Alert Management
    {
      resource: "alerts",
      action: "read",
      category: "security",
      description: "View security alerts",
    },
    {
      resource: "alerts",
      action: "create",
      category: "security",
      description: "Create security alerts",
    },
    {
      resource: "alerts",
      action: "update",
      category: "security",
      description: "Update security alerts",
    },
    {
      resource: "alerts",
      action: "delete",
      category: "security",
      description: "Delete security alerts",
    },

    // Ticket Management
    {
      resource: "tickets",
      action: "read",
      category: "security",
      description: "View support tickets",
    },
    {
      resource: "tickets",
      action: "create",
      category: "security",
      description: "Create support tickets",
    },
    {
      resource: "tickets",
      action: "update",
      category: "security",
      description: "Update support tickets",
    },
    {
      resource: "tickets",
      action: "delete",
      category: "security",
      description: "Delete support tickets",
    },
    {
      resource: "tickets",
      action: "analytics",
      category: "security",
      description: "View ticket analytics and statistics",
    },

    // User Management
    {
      resource: "user",
      action: "read",
      category: "user_management",
      description: "View user accounts",
    },
    {
      resource: "user",
      action: "create",
      category: "user_management",
      description: "Create new users",
    },
    {
      resource: "user",
      action: "update",
      category: "user_management",
      description: "Update existing users",
    },
    {
      resource: "user",
      action: "delete",
      category: "user_management",
      description: "Delete user accounts",
    },
    {
      resource: "user",
      action: "restore",
      category: "user_management",
      description: "Restore deleted user accounts",
    },
    {
      resource: "user",
      action: "analytics",
      category: "user_management",
      description: "View user analytics and statistics",
    },

    // Organisation Management
    {
      resource: "organisation",
      action: "read",
      category: "client_management",
      description: "View organisation information",
    },
    {
      resource: "organisation",
      action: "create",
      category: "client_management",
      description: "Create new organisations",
    },
    {
      resource: "organisation",
      action: "update",
      category: "client_management",
      description: "Update existing organisations",
    },
    {
      resource: "organisation",
      action: "delete",
      category: "client_management",
      description: "Delete organisations",
    },

    // Role Management
    {
      resource: "role",
      action: "read",
      category: "user_management",
      description: "View user roles",
    },
    {
      resource: "role",
      action: "create",
      category: "user_management",
      description: "Create new roles",
    },
    {
      resource: "role",
      action: "update",
      category: "user_management",
      description: "Update existing roles",
    },
    {
      resource: "role",
      action: "delete",
      category: "user_management",
      description: "Delete roles",
    },

    // Permission Management
    {
      resource: "permission",
      action: "read",
      category: "user_management",
      description: "View permissions",
    },
    {
      resource: "permission",
      action: "create",
      category: "user_management",
      description: "Create new permissions",
    },
    {
      resource: "permission",
      action: "update",
      category: "user_management",
      description: "Update existing permissions",
    },
    {
      resource: "permission",
      action: "delete",
      category: "user_management",
      description: "Delete permissions",
    },

    // Subscription Plan Management
    {
      resource: "plan",
      action: "read",
      category: "system",
      description: "View subscription plans",
    },
    {
      resource: "plan",
      action: "create",
      category: "system",
      description: "Create new subscription plans",
    },
    {
      resource: "plan",
      action: "update",
      category: "system",
      description: "Update existing subscription plans",
    },
    {
      resource: "plan",
      action: "delete",
      category: "system",
      description: "Delete subscription plans",
    },
    {
      resource: "plan",
      action: "analytics",
      category: "system",
      description: "View subscription plan analytics",
    },

    // Agent Management
    {
      resource: "agents",
      action: "read",
      category: "security",
      description: "View security agents",
    },
    {
      resource: "agents",
      action: "manage",
      category: "security",
      description: "Manage security agents",
    },
    {
      resource: "agents",
      action: "quarantine",
      category: "security",
      description: "Quarantine and unquarantine agents",
    },
    {
      resource: "agents",
      action: "download",
      category: "security",
      description: "Download agent CIS benchmark and vulnerability reports",
    },

    // SIEM Access
    {
      resource: "siem",
      action: "access",
      category: "security",
      description: "Access SIEM dashboard",
    },

    // Compliance
    {
      resource: "compliance",
      action: "read",
      category: "compliance",
      description: "View compliance reports",
    },
    {
      resource: "compliance",
      action: "download",
      category: "compliance",
      description: "Download compliance reports as CSV",
    },
    {
      resource: "compliance-details",
      action: "access",
      category: "compliance",
      description: "Access detailed compliance information in external CodecNet dashboard",
    },

    // Reporting
    {
      resource: "reports",
      action: "read",
      category: "reporting",
      description: "View reports",
    },
    {
      resource: "reports",
      action: "create",
      category: "reporting",
      description: "Create reports",
    },
    {
      resource: "reports",
      action: "download",
      category: "reporting",
      description: "Download reports",
    },
    {
      resource: "reports",
      action: "delete",
      category: "reporting",
      description: "Delete reports",
    },

    // Risk Management
    {
      resource: "risk-matrix",
      action: "read",
      category: "compliance",
      description: "View risk matrix",
    },

    // Settings
    {
      resource: "settings",
      action: "access",
      category: "system",
      description: "Access settings page",
    },

    // Asset Management
    {
      resource: "assets",
      action: "read",
      category: "asset_management",
      description: "View asset register",
    },
    {
      resource: "assets",
      action: "create",
      category: "asset_management",
      description: "Create new assets",
    },
    {
      resource: "assets",
      action: "update",
      category: "asset_management",
      description: "Update existing assets",
    },
    {
      resource: "assets",
      action: "delete",
      category: "asset_management",
      description: "Delete assets",
    },
    {
      resource: "assets",
      action: "manage",
      category: "asset_management",
      description: "Manage and sync assets from CodecNet Manager",
    },
  ],

  // Roles Configuration
  ROLES: [
    {
      role_name: "SuperAdmin",
      description: "System super administrator with full access to all features including agent quarantine",
      permissions: "ALL", // Special case - gets all permissions including agents:quarantine
    },
  ],

  // Users Configuration
  USERS: [
    {
      username: process.env.SEED_SUPERADMIN_USERNAME || "superadmin",
      email: process.env.SEED_SUPERADMIN_EMAIL || "superadmin@codec.com",
      password: (() => {
        if (!process.env.SEED_SUPERADMIN_PASSWORD) {
          throw new Error('SEED_SUPERADMIN_PASSWORD environment variable is required. Please set it in your .env file.');
        }
        return process.env.SEED_SUPERADMIN_PASSWORD;
      })(),
      full_name: process.env.SEED_SUPERADMIN_FULLNAME || "Super Administrator",
      role_name: "SuperAdmin",
      user_type: "internal",
      status: "active",
      phone_number: process.env.SEED_SUPERADMIN_PHONE ? (process.env.SEED_SUPERADMIN_PHONE.includes(' ') ? process.env.SEED_SUPERADMIN_PHONE : process.env.SEED_SUPERADMIN_PHONE.replace(/^(\+\d{1,4})(\d+)$/, '$1 $2')) : "+1 234567890",
    },
  ],

  // Organizations Configuration
  ORGANIZATIONS: [
    {
      client_name: process.env.ORG1_CLIENT_NAME || "Codec Networks",
      organisation_name: process.env.ORG1_ORGANISATION_NAME || "Codec Networks Pvt. Ltd.",
      industry: process.env.ORG1_INDUSTRY || "Cyber Security",
      organisation_type: "Client",
      subscription_plan_code: process.env.ORG1_SUBSCRIPTION_PLAN || "PRO",
      emails: [process.env.ORG1_EMAIL_1 || "contact@techcorp.com", process.env.ORG1_EMAIL_2 || "admin@techcorp.com"],
      phone_numbers: [process.env.ORG1_PHONE_1 || "+1 234567800", process.env.ORG1_PHONE_2 || "+1 234567801"],
      timezone: process.env.ORG1_TIMEZONE || "America/New_York",
      locale: process.env.ORG1_LOCALE || "en-US",
      wazuh_manager_ip: process.env.ORG1_WAZUH_MANAGER_IP || "122.176.142.223",
      wazuh_manager_port: parseInt(process.env.ORG1_WAZUH_MANAGER_PORT) || 55000,
      wazuh_manager_username: process.env.ORG1_WAZUH_MANAGER_USERNAME || "wazuh",
      wazuh_manager_password: process.env.ORG1_WAZUH_MANAGER_PASSWORD || "+LD2+*yPYhAZsL.J9Y.F7+6H6aFvoTnZ",
      wazuh_indexer_ip: process.env.ORG1_WAZUH_INDEXER_IP || "122.176.142.223",
      wazuh_indexer_port: parseInt(process.env.ORG1_WAZUH_INDEXER_PORT) || 9200,
      wazuh_indexer_username: process.env.ORG1_WAZUH_INDEXER_USERNAME || "admin",
      wazuh_indexer_password: process.env.ORG1_WAZUH_INDEXER_PASSWORD || "N3w.*e4.wwyTC?uYi31VqjSIT*k8d5.i",
      wazuh_dashboard_ip: process.env.ORG1_WAZUH_DASHBOARD_IP || "122.176.142.223",
      wazuh_dashboard_port: parseInt(process.env.ORG1_WAZUH_DASHBOARD_PORT) || 443,
      wazuh_dashboard_username: process.env.ORG1_WAZUH_DASHBOARD_USERNAME || "admin",
      wazuh_dashboard_password: process.env.ORG1_WAZUH_DASHBOARD_PASSWORD || "N3w.*e4.wwyTC?uYi31VqjSIT*k8d5.i",
    },
    {
      client_name: process.env.ORG2_CLIENT_NAME || "FinanceSecure",
      organisation_name: process.env.ORG2_ORGANISATION_NAME || "Global Finance Corp",
      industry: process.env.ORG2_INDUSTRY || "Financial Services",
      organisation_type: "Client",
      subscription_plan_code: process.env.ORG2_SUBSCRIPTION_PLAN || "ENT",
      emails: [process.env.ORG2_EMAIL_1 || "security@globalfinance.com"],
      phone_numbers: [process.env.ORG2_PHONE_1 || "+1 234567810"],
      timezone: process.env.ORG2_TIMEZONE || "America/Chicago",
      locale: process.env.ORG2_LOCALE || "en-US",
      wazuh_manager_ip: process.env.ORG2_WAZUH_MANAGER_IP || "192.168.1.130",
      wazuh_manager_port: parseInt(process.env.ORG2_WAZUH_MANAGER_PORT) || 55000,
      wazuh_manager_username: process.env.ORG2_WAZUH_MANAGER_USERNAME || "wazuh",
      wazuh_manager_password: process.env.ORG2_WAZUH_MANAGER_PASSWORD || "1rK.k+ctdawP8z3XhNio66Q8t8zGpGxP",
      wazuh_indexer_ip: process.env.ORG2_WAZUH_INDEXER_IP || "192.168.1.130",
      wazuh_indexer_port: parseInt(process.env.ORG2_WAZUH_INDEXER_PORT) || 9200,
      wazuh_indexer_username: process.env.ORG2_WAZUH_INDEXER_USERNAME || "admin",
      wazuh_indexer_password: process.env.ORG2_WAZUH_INDEXER_PASSWORD || "aBDQ.8oTtu7*UBP4Uqm51.Py9pUcLGla",
      wazuh_dashboard_ip: process.env.ORG2_WAZUH_DASHBOARD_IP || "192.168.1.130",
      wazuh_dashboard_port: parseInt(process.env.ORG2_WAZUH_DASHBOARD_PORT) || 443,
      wazuh_dashboard_username: process.env.ORG2_WAZUH_DASHBOARD_USERNAME || "admin",
      wazuh_dashboard_password: process.env.ORG2_WAZUH_DASHBOARD_PASSWORD || "aBDQ.8oTtu7*UBP4Uqm51.Py9pUcLGla",
    },
  ],

};

// =============================================================================
// SEEDING FUNCTIONS
// =============================================================================

const connectToDatabase = async () => {
  try {
    await mongoose.connect(SEED_CONFIG.DATABASE_URL);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

const clearCollections = async () => {
  console.log("🧹 Clearing existing data...");
  await Promise.all([
    Permission.deleteMany({}),
    Role.deleteMany({}),
    User.deleteMany({}),
    Organisation.deleteMany({}),
    SubscriptionPlan.deleteMany({}),
    // AccessRule.deleteMany({}), // Not used in application
  ]);
  console.log("✅ Collections cleared");
};

const seedSubscriptionPlans = async () => {
  console.log("📦 Seeding subscription plans...");
  const plans = [];

  for (const planConfig of SEED_CONFIG.SUBSCRIPTION_PLANS) {
    const plan = new SubscriptionPlan({
      ...planConfig,
      is_active: true,
    });
    await plan.save();
    plans.push(plan);
    console.log(`  ✓ Created plan: ${plan.plan_name} (${plan.plan_code})`);
  }

  return plans;
};

const seedPermissions = async () => {
  console.log("🔐 Seeding permissions...");
  const permissions = [];

  for (const permConfig of SEED_CONFIG.PERMISSIONS) {
    const permission = new Permission({
      permission_name: `${permConfig.resource}: ${permConfig.action}`,
      permission_code: permConfig.resource.toUpperCase() + "_" + permConfig.action.toUpperCase(),
      resource: permConfig.resource,
      action: permConfig.action,
      category: permConfig.category,
      description: permConfig.description,
      status: true,
    });
    await permission.save();
    permissions.push(permission);
    console.log(`  ✓ Created permission: ${permission.permission_name}`);
  }

  return permissions;
};

const seedRoles = async (permissions) => {
  console.log("👥 Seeding roles...");
  const roles = [];

  // Create permission lookup map
  const permissionMap = {};
  permissions.forEach((perm) => {
    permissionMap[`${perm.resource}:${perm.action}`] = perm;
  });

  for (const roleConfig of SEED_CONFIG.ROLES) {
    let rolePermissions = {};

    if (roleConfig.permissions === "ALL") {
      // SuperAdmin gets all permissions
      permissions.forEach((perm) => {
        if (!rolePermissions[perm.resource]) {
          rolePermissions[perm.resource] = {};
        }
        rolePermissions[perm.resource][perm.action] = true;
      });
    } else {
      // Build permissions object from array
      roleConfig.permissions.forEach((permString) => {
        const [resource, action] = permString.split(":");
        if (!rolePermissions[resource]) {
          rolePermissions[resource] = {};
        }
        rolePermissions[resource][action] = true;
      });
    }

    const role = new Role({
      role_name: roleConfig.role_name,
      description: roleConfig.description,
      permissions: rolePermissions,
      status: true,
    });

    await role.save();
    roles.push(role);
    console.log(
      `  ✓ Created role: ${role.role_name} with ${Object.keys(rolePermissions).length
      } permission categories`
    );
  }

  return roles;
};

const seedUsers = async (roles) => {
  console.log("👤 Seeding users...");
  const users = [];

  // Create role lookup map
  const roleMap = {};
  roles.forEach((role) => {
    roleMap[role.role_name] = role;
  });

  for (const userConfig of SEED_CONFIG.USERS) {
    const role = roleMap[userConfig.role_name];
    if (!role) {
      console.error(
        `  ❌ Role ${userConfig.role_name} not found for user ${userConfig.username}`
      );
      continue;
    }

    const hashedPassword = await bcrypt.hash(userConfig.password, 12);

    const user = new User({
      username: userConfig.username,
      email: userConfig.email,
      password_hash: hashedPassword,
      full_name: userConfig.full_name,
      role_id: role._id,
      user_type: userConfig.user_type,
      status: userConfig.status,
      phone_number: userConfig.phone_number,
      is_email_verified: true,
      timezone: "UTC",
      locale: "en-IN",
    });

    await user.save();
    users.push(user);
    console.log(
      `  ✓ Created user: ${user.username} (${user.email}) - ${role.role_name}`
    );
  }

  return users;
};

const seedOrganizations = async (subscriptionPlans, users) => {
  console.log("🏢 Seeding organizations...");
  const organizations = [];

  // Create subscription plan lookup map
  const planMap = {};
  subscriptionPlans.forEach((plan) => {
    planMap[plan.plan_code] = plan;
  });

  // Find a user to assign as creator (preferably SuperAdmin)
  const creator =
    users.find((user) => user.username === "superadmin") || users[0];

  for (const orgConfig of SEED_CONFIG.ORGANIZATIONS) {
    const subscriptionPlan = planMap[orgConfig.subscription_plan_code];
    if (!subscriptionPlan) {
      console.error(
        `  ❌ Subscription plan ${orgConfig.subscription_plan_code} not found`
      );
      continue;
    }

    const organization = new Organisation({
      client_name: orgConfig.client_name,
      organisation_name: orgConfig.organisation_name,
      industry: orgConfig.industry,
      organisation_type: orgConfig.organisation_type,
      subscription_plan_id: subscriptionPlan._id,
      subscription_status: "active",
      emails: orgConfig.emails,
      phone_numbers: orgConfig.phone_numbers,
      timezone: orgConfig.timezone,
      locale: orgConfig.locale,
      wazuh_manager_ip: orgConfig.wazuh_manager_ip,
      wazuh_manager_port: orgConfig.wazuh_manager_port,
      wazuh_manager_username: orgConfig.wazuh_manager_username,
      wazuh_manager_password: orgConfig.wazuh_manager_password,
      wazuh_indexer_ip: orgConfig.wazuh_indexer_ip,
      wazuh_indexer_port: orgConfig.wazuh_indexer_port,
      wazuh_indexer_username: orgConfig.wazuh_indexer_username,
      wazuh_indexer_password: orgConfig.wazuh_indexer_password,
      wazuh_dashboard_ip: orgConfig.wazuh_dashboard_ip,
      wazuh_dashboard_port: orgConfig.wazuh_dashboard_port,
      wazuh_dashboard_username: orgConfig.wazuh_dashboard_username,
      wazuh_dashboard_password: orgConfig.wazuh_dashboard_password,
      status: "active",
      created_by: creator._id,
      current_user_count: 0,
      current_asset_count: 0,
    });

    await organization.save();
    organizations.push(organization);
    console.log(
      `  ✓ Created organization: ${organization.client_name} (${subscriptionPlan.plan_name})`
    );
  }

  return organizations;
};

// const seedAccessRules = async () => {
//   console.log("🛡 Seeding access rules...");
//   const accessRules = [];
//   // AccessRule feature is not used in the application
//   return accessRules;
// };

// =============================================================================
// MAIN EXECUTION
// =============================================================================

const main = async () => {
  console.log("🚀 Starting comprehensive database seeding...\n");

  try {
    // Connect to database
    await connectToDatabase();

    // Clear existing data
    await clearCollections();

    // Seed data in correct order (respecting dependencies)
    console.log("\n📋 Seeding process started...");

    const subscriptionPlans = await seedSubscriptionPlans();
    const permissions = await seedPermissions();
    const roles = await seedRoles(permissions);
    const users = await seedUsers(roles);
    const organizations = await seedOrganizations(subscriptionPlans, users);
    // const accessRules = await seedAccessRules(); // Not used in application

    // Summary
    console.log("\n📊 Seeding Summary:");
    console.log(`  • ${subscriptionPlans.length} subscription plans created`);
    console.log(`  • ${permissions.length} permissions created`);
    console.log(`  • ${roles.length} roles created`);
    console.log(`  • ${users.length} users created`);
    console.log(`  • ${organizations.length} organizations created`);
    // console.log(`  • ${accessRules.length} access rules created`); // Not used

    console.log("\n👤 User Accounts Created:");
    users.forEach((user) => {
      const userConfig = SEED_CONFIG.USERS.find(
        (u) => u.username === user.username
      );
      console.log(
        `  • ${user.username}: ${user.email}`
      );
    });

    console.log("\n✅ Database seeding completed successfully!");
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
};

// Run the seeding process
main();