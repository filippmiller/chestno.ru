"""APScheduler integration for background tasks."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def process_reminders_job():
    """Job to process pending reminders."""
    try:
        from app.services.notifications import process_reminders
        result = process_reminders()
        if result['processed'] > 0:
            logger.info(f'Processed {result["processed"]} reminders, created {result["notifications_created"]} notifications')
    except Exception as e:
        logger.error(f'Error processing reminders: {e}')


async def process_email_deliveries_job():
    """Job to process pending email deliveries."""
    try:
        from app.services.notifications import process_email_deliveries
        result = await process_email_deliveries()
        if result['processed'] > 0:
            logger.info(f'Processed {result["processed"]} email deliveries, sent {result["sent"]}')
    except Exception as e:
        logger.error(f'Error processing email deliveries: {e}')


async def process_telegram_deliveries_job():
    """Job to process pending telegram deliveries."""
    try:
        from app.services.notifications import process_telegram_deliveries
        result = await process_telegram_deliveries()
        if result['processed'] > 0:
            logger.info(f'Processed {result["processed"]} telegram deliveries, sent {result["sent"]}')
    except Exception as e:
        logger.error(f'Error processing telegram deliveries: {e}')


async def process_push_deliveries_job():
    """Job to process pending push deliveries."""
    try:
        from app.services.push import process_push_deliveries
        result = await process_push_deliveries()
        if result['processed'] > 0:
            logger.info(f'Processed {result["processed"]} push deliveries, sent {result["sent"]}')
    except Exception as e:
        logger.error(f'Error processing push deliveries: {e}')


def start_scheduler():
    """Start the scheduler with all jobs."""
    if scheduler.running:
        logger.warning('Scheduler already running')
        return

    # Process reminders every minute
    scheduler.add_job(
        process_reminders_job,
        IntervalTrigger(minutes=1),
        id='process_reminders',
        name='Process pending reminders',
        replace_existing=True,
    )

    # Process email deliveries every 30 seconds
    scheduler.add_job(
        process_email_deliveries_job,
        IntervalTrigger(seconds=30),
        id='process_email_deliveries',
        name='Process pending email deliveries',
        replace_existing=True,
    )

    # Process telegram deliveries every 30 seconds
    scheduler.add_job(
        process_telegram_deliveries_job,
        IntervalTrigger(seconds=30),
        id='process_telegram_deliveries',
        name='Process pending telegram deliveries',
        replace_existing=True,
    )

    # Process push deliveries every 15 seconds
    scheduler.add_job(
        process_push_deliveries_job,
        IntervalTrigger(seconds=15),
        id='process_push_deliveries',
        name='Process pending push deliveries',
        replace_existing=True,
    )

    scheduler.start()
    logger.info('Scheduler started with notification processing jobs')


def stop_scheduler():
    """Stop the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info('Scheduler stopped')


@asynccontextmanager
async def lifespan_scheduler() -> AsyncGenerator[None, None]:
    """Context manager for scheduler lifespan in FastAPI."""
    start_scheduler()
    yield
    stop_scheduler()
