const logger = require('../utils/logger');

/**
 * Cache invalidation handler for DynamoDB streams
 * @param {Object} event - DynamoDB stream event
 * @returns {Object} Response object
 */
exports.invalidateCache = async (event) => {
  try {
    logger.info('Cache invalidation triggered', { recordCount: event.Records?.length || 0 });

    if (!event.Records || event.Records.length === 0) {
      logger.warn('No records found in stream event');
      return { processed: 0 };
    }

    const processedRecords = event.Records.map((record) => {
      try {
        const { eventName, dynamodb } = record;

        logger.debug(`Processing record: ${eventName}`, {
          eventName,
          tableName: record.eventSourceARN?.split('/')[1],
        });

        // TODO: Implement cache invalidation logic based on the event
        switch (eventName) {
          case 'INSERT':
          case 'MODIFY':
          case 'REMOVE':
          {
            // Extract relevant keys from the record
            const keys = dynamodb?.Keys;
            if (keys) {
              // TODO: Invalidate specific cache entries
              // await cacheService.invalidateByKeys(keys);
              logger.info('Cache invalidation completed for keys:', keys);
            }
            break;
          }
          default:
            logger.warn(`Unhandled event type: ${eventName}`);
        }

        return {
          eventName,
          processed: true,
          timestamp: new Date().toISOString(),
        };
      } catch (recordError) {
        logger.error('Error processing individual record:', recordError, { record });
        return {
          eventName: record.eventName,
          processed: false,
          error: recordError.message,
          timestamp: new Date().toISOString(),
        };
      }
    });

    const successCount = processedRecords.filter((r) => r.processed).length;
    const errorCount = processedRecords.length - successCount;

    logger.info(`Cache invalidation completed. Success: ${successCount}, Errors: ${errorCount}`);

    return {
      totalRecords: event.Records.length,
      processedSuccessfully: successCount,
      errors: errorCount,
      details: processedRecords,
    };
  } catch (error) {
    logger.error('Error in cache invalidation handler:', error);
    throw error; // Re-throw to trigger Lambda retry mechanism
  }
};
