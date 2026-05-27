import ora from 'ora';

export function createSpinner(text) {
  return ora({
    text,
    spinner: 'dots',
    color: 'cyan',
  });
}

export async function withSpinner(text, fn) {
  const spinner = createSpinner(text);
  spinner.start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export function successSpinner(spinner, text) {
  spinner.succeed(text);
}

export function failSpinner(spinner, text) {
  spinner.fail(text);
}

export function warnSpinner(spinner, text) {
  spinner.warn(text);
}

export function infoSpinner(spinner, text) {
  spinner.info(text);
}
