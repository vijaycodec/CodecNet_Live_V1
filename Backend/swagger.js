// swagger.js
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SIEM API Docs Backend',
      version: '1.0.0',
      description: 'API documentation for your SIEM Backend project',
    },
    servers: [
      {
        url: 'http://localhost:5000', // Replace with your URL 
      },
    ],
  },
  apis: ['./routes/*.js'], // Path to your API route files with Swagger comments
};

const swaggerSpec = swaggerJSDoc(options);

export const swaggerDocs = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
