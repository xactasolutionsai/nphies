Currently, the polling mechanism in our system is implemented inside the Request Details page, meaning that polling is triggered per specific bundle or per specific prior authorization request.

However, according to the NPHIES messaging architecture, this approach is incorrect.

The Problem

In NPHIES, polling is not request-specific and is not tied to a bundle ID.

Polling operates at the system (endpoint) level, not at the individual request level.

When a Poll request is sent:

The system retrieves all queued messages for the organization endpoint.

The response may contain:

Prior Authorization responses

Claim responses

Communication responses

Other message types

It does not return a response for a specific bundle or a specific prior authorization.

By implementing polling inside the Request Details page, we mistakenly assumed that:

Polling retrieves the response related only to the currently opened request.

This assumption is incorrect because NPHIES uses a queue-based asynchronous messaging model.

Correct Architecture

Polling must be implemented as a system-level background service, not as a per-request action.

The correct design should be:

A background worker periodically sends a Poll request.

The system retrieves all pending messages.

Each returned message is mapped using:

MessageHeader.response.identifier

The system matches the response to the original outbound message stored in the database.

The relevant request record is updated accordingly.

The UI (Request Details page) should only display the updated status from the database — it should not trigger polling directly.

Summary

The mistake in the current implementation is treating Poll as a request-level operation.

In reality:

Polling is endpoint-wide

It retrieves all pending messages

Response-to-request matching must be handled internally through message correlation

Polling should run as a background system process