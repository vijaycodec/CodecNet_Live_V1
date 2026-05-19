import jwt from 'jsonwebtoken';

export const accessClientDashboard = async (req, res) => {
  try {
    // 1. Generate time-limited access token (15 minutes)
    const dashboardToken = jwt.sign(
      {
        clientId: req.client._id,
        clientUserId: req.client.user._id,
        accessedBy: req.superadmin._id,
        isDashboardAccess: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // 2. Prepare safe client data (no sensitive info)
    const clientData = {
      id: req.client.user._id,
      name: `${req.client.user.firstName} ${req.client.user.lastName}`,
      email: req.client.user.email,
      role: req.client.user.role
    };

    // 3. Return response
    res.json({
      success: true,
      token: dashboardToken,
      client: clientData,
      accessDetails: {
        grantedAt: new Date(),
        expiresIn: '15 minutes',
        accessedBy: {
          id: req.superadmin._id,
          name: `${req.superadmin.firstName} ${req.superadmin.lastName}`
        }
      }
    });

  } catch (error) {
    console.error('Dashboard access error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate dashboard access'
    });
  }
};