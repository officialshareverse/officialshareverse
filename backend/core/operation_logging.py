import json
import logging


operations_logger = logging.getLogger("core.operations")


def log_operation_event(event, level="info", **context):
    payload = {"event": event, **context}
    log_method = getattr(operations_logger, level, operations_logger.info)
    log_method(json.dumps(payload, default=str, sort_keys=True))
