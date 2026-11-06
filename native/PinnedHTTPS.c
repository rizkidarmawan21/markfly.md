#include "PinnedHTTPS.h"
#include <curl/curl.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    MarkflyHTTPSResponse *response;
    size_t limit;
} BodyBuffer;

static size_t append_body(char *bytes, size_t size, size_t count, void *context) {
    BodyBuffer *buffer = context;
    MarkflyHTTPSResponse *response = buffer->response;
    size_t length = size * count;
    if (length > buffer->limit - response->count) {
        response->error = "Response exceeds the download size limit.";
        return 0;
    }
    if (!length) return 0;
    unsigned char *body = realloc(response->bytes, response->count + length);
    if (!body) return 0;
    memcpy(body + response->count, bytes, length);
    response->bytes = body;
    response->count += length;
    return length;
}

void markfly_https_init(void) {
    curl_global_init(CURL_GLOBAL_DEFAULT);
}

MarkflyHTTPSResponse markfly_https_get(const char *url, const char *connection,
                                      const char *accept, size_t limit) {
    MarkflyHTTPSResponse response = {0};
    BodyBuffer buffer = {&response, limit};
    CURL *curl = curl_easy_init();
    struct curl_slist *pin = curl_slist_append(NULL, connection);
    struct curl_slist *headers = curl_slist_append(NULL, accept);
    if (!curl || !pin || !headers) {
        response.error = "Unable to initialize HTTPS request.";
        goto cleanup;
    }

    curl_easy_setopt(curl, CURLOPT_URL, url);
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    curl_easy_setopt(curl, CURLOPT_PROTOCOLS, (long) CURLPROTO_HTTPS);
#pragma clang diagnostic pop
    // This pin applies to every hostname and port, including numeric URLs.
    if (curl_easy_setopt(curl, CURLOPT_CONNECT_TO, pin) != CURLE_OK ||
        curl_easy_setopt(curl, CURLOPT_PROXY, "") != CURLE_OK) {
        response.error = "Unable to pin HTTPS connection.";
        goto cleanup;
    }
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 0L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 2L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, 15000L);
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
    curl_easy_setopt(curl, CURLOPT_MAXFILESIZE_LARGE, (curl_off_t) limit);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_ACCEPT_ENCODING, "identity");
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "Markfly");
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, append_body);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &buffer);

    CURLcode result = curl_easy_perform(curl);
    if (result != CURLE_OK) {
        if (result == CURLE_FILESIZE_EXCEEDED) response.error = "Response exceeds the download size limit.";
        if (!response.error) response.error = curl_easy_strerror(result);
        goto cleanup;
    }
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response.status);
    char *redirect = NULL;
    curl_easy_getinfo(curl, CURLINFO_REDIRECT_URL, &redirect);
    if (redirect) response.redirect = strdup(redirect);

cleanup:
    curl_slist_free_all(pin);
    curl_slist_free_all(headers);
    if (curl) curl_easy_cleanup(curl);
    return response;
}

void markfly_https_free(MarkflyHTTPSResponse response) {
    free(response.bytes);
    free(response.redirect);
}

int markfly_openat(int directory, const char *name, int flags, unsigned short mode) {
    return openat(directory, name, flags, (mode_t)mode);
}
