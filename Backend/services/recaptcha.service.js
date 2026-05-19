import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

// Configuration from environment variables
const RECAPTCHA_PROJECT_ID = process.env.RECAPTCHA_PROJECT_ID || 'codecnet-1762237741353';
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || '6LcgwAEsAAAAAOt45FtSbnP-NV_WThz1M_5nBMlM';
const RECAPTCHA_THRESHOLD = parseFloat(process.env.RECAPTCHA_THRESHOLD || '0.5');

/**
 * Create reCAPTCHA Enterprise assessment
 * @param {string} token - reCAPTCHA token from frontend
 * @param {string} recaptchaAction - Action being performed (e.g., 'LOGIN')
 * @param {string} expectedAction - Expected action to verify against
 * @returns {Promise<Object>} Assessment result with success status, score, and reasons
 */
async function createAssessment(token, recaptchaAction, expectedAction = null) {
  console.log('🔐 [RECAPTCHA] Creating assessment for action:', recaptchaAction);

  try {
    const client = new RecaptchaEnterpriseServiceClient();
    const projectPath = client.projectPath(RECAPTCHA_PROJECT_ID);

    const request = {
      assessment: {
        event: {
          token: token,
          siteKey: RECAPTCHA_SITE_KEY,
        },
      },
      parent: projectPath,
    };

    console.log('🔐 [RECAPTCHA] Sending assessment request to Google Cloud');
    const [response] = await client.createAssessment(request);

    // Validate token
    if (!response.tokenProperties.valid) {
      console.warn('⚠️ [RECAPTCHA] Token invalid:', response.tokenProperties.invalidReason);
      return {
        success: false,
        valid: false,
        reason: response.tokenProperties.invalidReason,
        score: 0,
      };
    }

    // Verify action matches
    const actionToVerify = expectedAction || recaptchaAction;
    if (response.tokenProperties.action !== actionToVerify) {
      console.warn('⚠️ [RECAPTCHA] Action mismatch. Expected:', actionToVerify, 'Got:', response.tokenProperties.action);
      return {
        success: false,
        valid: true,
        reason: 'ACTION_MISMATCH',
        score: 0,
      };
    }

    // Check risk score
    const score = response.riskAnalysis.score;
    const passed = score >= RECAPTCHA_THRESHOLD;

    console.log(`✅ [RECAPTCHA] Assessment complete. Score: ${score}, Threshold: ${RECAPTCHA_THRESHOLD}, Passed: ${passed}`);

    return {
      success: passed,
      valid: true,
      score: score,
      reasons: response.riskAnalysis.reasons || [],
      threshold: RECAPTCHA_THRESHOLD,
    };
  } catch (error) {
    console.error('❌ [RECAPTCHA] Error creating assessment:', error.message);

    // Return failure on error - fail secure
    return {
      success: false,
      valid: false,
      reason: 'ASSESSMENT_ERROR',
      score: 0,
      error: error.message,
    };
  }
}

/**
 * Verify reCAPTCHA token for login action
 * @param {string} token - reCAPTCHA token from frontend
 * @returns {Promise<Object>} Verification result
 */
async function verifyLoginToken(token) {
  console.log('🔐 [RECAPTCHA] Verifying login token');

  if (!token) {
    console.warn('⚠️ [RECAPTCHA] No token provided');
    return {
      success: false,
      valid: false,
      reason: 'MISSING_TOKEN',
      score: 0,
    };
  }

  // Create assessment for LOGIN action
  const result = await createAssessment(token, 'LOGIN', 'LOGIN');

  if (!result.success) {
    console.warn('⚠️ [RECAPTCHA] Login token verification failed:', result.reason);
  } else {
    console.log('✅ [RECAPTCHA] Login token verified successfully. Score:', result.score);
  }

  return result;
}

/**
 * Get reCAPTCHA configuration for frontend
 * @returns {Object} Configuration object with siteKey and projectId
 */
function getRecaptchaConfig() {
  console.log('ℹ️ [RECAPTCHA] Providing configuration to frontend');
  return {
    siteKey: RECAPTCHA_SITE_KEY,
    projectId: RECAPTCHA_PROJECT_ID,
    threshold: RECAPTCHA_THRESHOLD,
  };
}

/**
 * Express middleware for verifying reCAPTCHA token
 * Validates token before allowing request to proceed
 */
const verifyRecaptchaMiddleware = async (req, res, next) => {
  console.log('🔐 [RECAPTCHA] Middleware: Verifying reCAPTCHA token for request');

  // Dev bypass: production site key + Google Cloud creds aren't available locally
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ [RECAPTCHA] NODE_ENV=development — skipping reCAPTCHA verification');
    return next();
  }

  const token = req.body.recaptchaToken;

  // ⚠️ DEVELOPMENT ONLY: Skip verification if no token provided
  // TODO: Remove this bypass before production deployment
  if (!token) {
    console.warn('⚠️ [RECAPTCHA] Development mode: No token provided, skipping verification');
    console.warn('⚠️ [RECAPTCHA] WARNING: This MUST be fixed before production!');
    return next();
  }

  const result = await verifyLoginToken(token);

  if (!result.success) {
    console.warn('⚠️ [RECAPTCHA] Middleware: Verification failed -', result.reason, 'Score:', result.score);
    return res.status(403).json({
      success: false,
      message: 'reCAPTCHA verification failed. Please try again.',
      error: 'RECAPTCHA_VERIFICATION_FAILED',
      details: {
        reason: result.reason,
        score: result.score,
        threshold: result.threshold,
      },
    });
  }

  console.log('✅ [RECAPTCHA] Middleware: Verification successful. Score:', result.score);

  // Attach result to request for potential use in controller
  req.recaptchaResult = result;
  next();
};

export {
  createAssessment,
  verifyLoginToken,
  verifyRecaptchaMiddleware,
  getRecaptchaConfig,
};
