import { isValidEmailAddress } from '../../../supabase/functions/_shared/emailValidation.ts';
import type { SupportRequestTopicId } from './supportRequestTopics';
import { topicRequiresCustomSubject } from './supportRequestTopics';

export const SUPPORT_SUBJECT_MIN = 5;
export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_MESSAGE_MIN = 20;
export const SUPPORT_MESSAGE_MAX = 5000;

export interface SupportRequestFormValues {
  topicId: SupportRequestTopicId;
  subject: string;
  message: string;
  contactEmail: string;
}

export interface SupportRequestValidationResult {
  ok: boolean;
  errors: Partial<Record<'topicId' | 'subject' | 'message' | 'contactEmail', string>>;
}

export function validateSupportRequestForm(
  values: SupportRequestFormValues,
  options: { requireContactEmail: boolean },
): SupportRequestValidationResult {
  const errors: SupportRequestValidationResult['errors'] = {};

  if (!values.topicId) {
    errors.topicId = 'Select a support topic.';
  }

  const subject = values.subject.trim();
  if (topicRequiresCustomSubject(values.topicId)) {
    if (!subject) {
      errors.subject = 'Enter your subject.';
    }
  } else if (!subject) {
    errors.subject = 'Subject is required.';
  }

  if (subject && (subject.length < SUPPORT_SUBJECT_MIN || subject.length > SUPPORT_SUBJECT_MAX)) {
    errors.subject = `Subject must be between ${SUPPORT_SUBJECT_MIN} and ${SUPPORT_SUBJECT_MAX} characters.`;
  }

  const message = values.message.trim();
  if (!message) {
    errors.message = 'Message is required.';
  } else if (message.length < SUPPORT_MESSAGE_MIN || message.length > SUPPORT_MESSAGE_MAX) {
    errors.message = `Message must be between ${SUPPORT_MESSAGE_MIN} and ${SUPPORT_MESSAGE_MAX} characters.`;
  }

  const contactEmail = values.contactEmail.trim();
  if (options.requireContactEmail) {
    if (!contactEmail) {
      errors.contactEmail = 'Enter your email address so we can reply.';
    } else if (!isValidEmailAddress(contactEmail)) {
      errors.contactEmail = 'Enter a valid email address.';
    }
  } else if (contactEmail && !isValidEmailAddress(contactEmail)) {
    errors.contactEmail = 'Enter a valid email address.';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}
