// public/js/utils.js

/**
 * Retrieve a cookie value by name.
 * @param {string} name
 * @returns {string|null}
 */
export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }