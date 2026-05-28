const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Manga Creation Workflow API',
      version: '1.0.0',
      description: 'API Documentation for BE1 - Auth & Proposal Flow. Allows testing endpoints directly.',
      contact: {
        name: 'Developer Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: {
              type: 'string',
              enum: ['MANGAKA', 'ASSISTANT', 'EDITOR', 'BOARD_MEMBER'],
            },
          },
        },
        Series: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            synopsis: { type: 'string' },
            mangakaId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'IN_PRODUCTION', 'PUBLISHED', 'REJECTED', 'CANCELLED'],
            },
            pubSchedule: {
              type: 'string',
              enum: ['WEEKLY', 'MONTHLY'],
              nullable: true,
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Scan routes for JSDoc documentation
};

const specs = swaggerJsDoc(options);

module.exports = {
  swaggerUi,
  specs,
};
