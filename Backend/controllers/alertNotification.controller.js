import EmailLog from '../models/emailLog.model.js';
import Organisation from '../models/organisation.model.js';
import { sendCriticalAlertEmail } from '../services/alertNotification.service.js';
import { verifySmtpConnection, getSenderEmail, getDefaultCc } from '../services/email.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

// GET /api/alert-notifications/logs?organisationId=&status=&limit=&page=
export const listEmailLogs = asyncHandler(async (req, res) => {
  const { organisationId, status, limit = 50, page = 1, alert_id } = req.query;

  const filter = {};
  if (organisationId) filter.organisation_id = organisationId;
  if (status) filter.status = status;
  if (alert_id) filter.alert_id = alert_id;

  // Scope external users to their organisation
  if (req.user?.user_type === 'external') {
    const userOrgId = req.user.organisation_id?._id || req.user.organisation_id;
    if (userOrgId) filter.organisation_id = userOrgId;
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
  const skip = (pageNum - 1) * lim;

  const [logs, total] = await Promise.all([
    EmailLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    EmailLog.countDocuments(filter)
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      logs,
      total,
      page: pageNum,
      limit: lim,
      pages: Math.ceil(total / lim)
    }, 'Email logs fetched successfully')
  );
});

// POST /api/alert-notifications/test
// Body: { organisationId?, alert?: {...}, extraCc?: [] }
// If no alert is supplied, sends a synthetic critical alert (for SMTP/Hostinger setup testing).
export const sendTestAlertEmail = asyncHandler(async (req, res) => {
  const { organisationId, alert, extraCc = [] } = req.body || {};

  const syntheticAlert = alert || {
    alert_id: `test-${Date.now()}`,
    alert_title: 'Test Critical Alert',
    alert_severity: 13,
    alert_source: 'CodecNet SOC - Test Trigger',
    alert_time: new Date().toISOString(),
    alert_description: 'This is a test critical-alert email triggered manually from the dashboard. No action is required.',
    agent: {
      name: 'WIN-SOC-TEST-01',
      id: '001',
      ip: '10.0.0.42'
    },
    rule: {
      level: 13,
      description: 'Multiple failed logon attempts followed by a successful logon (possible brute force).',
      mitre: {
        id: ['T1110.001', 'T1078'],
        technique: ['Password Guessing', 'Valid Accounts']
      }
    },
    data: {
      srcip: '203.0.113.45',
      srcport: '52431',
      win: {
        eventdata: {
          targetUserName: 'administrator',
          authenticationPackageName: 'NTLM',
          logonType: '3'
        }
      }
    },
    GeoLocation: {
      country_name: 'Russia'
    },
    location: {
      country: 'Russia'
    }
  };

  const result = await sendCriticalAlertEmail({
    alert: syntheticAlert,
    organisationId: organisationId || null,
    extraCc,
    emailType: alert ? 'critical_alert' : 'manual_test'
  });

  if (result.skipped) {
    return res.status(200).json(
      new ApiResponse(200, result, `Email not sent: ${result.reason}`)
    );
  }

  if (result.error) {
    return res.status(502).json(
      new ApiResponse(502, result, `Email send failed: ${result.error}`)
    );
  }

  return res.status(200).json(
    new ApiResponse(200, { logId: result.log._id, log: result.log }, 'Test alert email sent successfully')
  );
});

// GET /api/alert-notifications/smtp/verify
export const verifySmtp = asyncHandler(async (req, res) => {
  const result = await verifySmtpConnection();
  if (!result.ok) {
    return res.status(502).json(new ApiResponse(502, result, 'SMTP verification failed'));
  }
  return res.status(200).json(new ApiResponse(200, {
    ...result,
    sender: getSenderEmail(),
    defaultCc: getDefaultCc()
  }, 'SMTP connection verified'));
});

// PUT /api/alert-notifications/cc/:organisationId
// Body: { cc_emails: [string], alert_email_notifications_enabled?: boolean }
export const updateOrgCcEmails = asyncHandler(async (req, res) => {
  const { organisationId } = req.params;
  const { cc_emails, alert_email_notifications_enabled } = req.body || {};

  const update = {};
  if (Array.isArray(cc_emails)) {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    for (const e of cc_emails) {
      if (typeof e !== 'string' || !emailRegex.test(e)) {
        throw new ApiError(400, `Invalid email address: ${e}`);
      }
    }
    update.cc_emails = cc_emails.map(e => e.trim().toLowerCase());
  }
  if (typeof alert_email_notifications_enabled === 'boolean') {
    update.alert_email_notifications_enabled = alert_email_notifications_enabled;
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, 'Nothing to update. Provide cc_emails and/or alert_email_notifications_enabled');
  }

  const org = await Organisation.findByIdAndUpdate(
    organisationId,
    { $set: update },
    { new: true, runValidators: true }
  ).select('organisation_name emails cc_emails alert_email_notifications_enabled');

  if (!org) throw new ApiError(404, 'Organisation not found');

  return res.status(200).json(
    new ApiResponse(200, org, 'Organisation alert notification settings updated')
  );
});

// GET /api/alert-notifications/cc/:organisationId
export const getOrgCcEmails = asyncHandler(async (req, res) => {
  const { organisationId } = req.params;
  const org = await Organisation.findById(organisationId).select(
    'organisation_name emails cc_emails alert_email_notifications_enabled'
  );
  if (!org) throw new ApiError(404, 'Organisation not found');

  return res.status(200).json(
    new ApiResponse(200, {
      ...org.toObject(),
      default_cc: getDefaultCc(),
      sender_email: getSenderEmail()
    }, 'Organisation alert notification settings fetched')
  );
});
