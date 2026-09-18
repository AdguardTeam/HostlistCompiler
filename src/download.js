const { FiltersDownloader } = require('@adguard/filters-downloader');

/**
 * Downloads the specified source (a URL or a local file path) and
 * resolves all `!#include` directives in it.
 *
 * @param {String} source - URL or local file path of the source.
 * @returns {Promise<Array<String>>} array with the source rules.
 */
async function download(source) {
    return FiltersDownloader.download(source, {}, { allowEmptyResponse: true });
}

module.exports = {
    download,
};
