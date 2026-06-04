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
            editorId: { type: 'string', nullable: true },
          },
        },
        Task: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            seriesId: { type: 'string' },
            chapterId: { type: 'string' },
            assignedTo: { type: 'string' },
            assignedBy: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            pageIds: { type: 'array', items: { type: 'string' } },
            status: {
              type: 'string',
              enum: ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED'],
            },
            submittedAt: { type: 'string', format: 'date-time' },
            reviewNote: { type: 'string' },
            reviewedAt: { type: 'string', format: 'date-time' },
            dueAt: { type: 'string', format: 'date-time' },
          },
        },
        Page: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            chapterId: { type: 'string' },
            pageNumber: { type: 'number' },
            imageUrl: { type: 'string' },
            assistantImageUrl: { type: 'string' },
            resources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  url: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            status: {
              type: 'string',
              enum: ['DRAFT', 'HAS_TASK', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REVISION_REQUESTED'],
            },
            note: { type: 'string' },
            reviewNote: { type: 'string' },
            approvedAt: { type: 'string', format: 'date-time' },
          },
        },
        AssistantEarning: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            assistantId: { type: 'string' },
            month: { type: 'string', example: '2026-06' },
            totalPagesApproved: { type: 'number' },
            ratePerPage: { type: 'number' },
            totalEarning: { type: 'number' },
            approvedPages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  pageId: { type: 'string' },
                  chapterId: { type: 'string' },
                  seriesId: { type: 'string' },
                  approvedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            paymentStatus: {
              type: 'string',
              enum: ['PENDING', 'PAID'],
            },
            paidAt: { type: 'string', format: 'date-time' },
          },
        },
        Annotation: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            pageId: { type: 'string' },
            annotatorId: { type: 'string' },
            coords: { type: 'object' },
            content: { type: 'string' },
            type: {
              type: 'string',
              enum: ['CONTENT', 'SCRIPT', 'DIALOGUE'],
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
