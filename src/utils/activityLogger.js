const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const logAction = async ({ userId, action, entity, entityId, metadata }) => {
  try {
    const label = entity.replace(/([A-Z])/g, " $1").trim();

    await prisma.activityLog.create({
      data: {
        userId: userId || null,
        action,
        entity,
        entityId: entityId || null,
        metadata: metadata || undefined,
      },
    });

    await prisma.notification.create({
      data: {
        title: `${label} ${action.toLowerCase()}`,
        message: `${label} was ${action.toLowerCase()} successfully.`,
        type: "ACTIVITY",
      },
    });
  } catch (error) {
    console.error("Activity notification logging error:", error);
  }
};

module.exports = { logAction };
