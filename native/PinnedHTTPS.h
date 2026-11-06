#ifndef MARKFLY_PINNED_HTTPS_H
#define MARKFLY_PINNED_HTTPS_H

#include <stddef.h>

typedef struct {
    unsigned char *bytes;
    size_t count;
    long status;
    char *redirect;
    const char *error;
} MarkflyHTTPSResponse;

void markfly_https_init(void);
MarkflyHTTPSResponse markfly_https_get(const char *url, const char *connection,
                                      const char *accept, size_t limit);
void markfly_https_free(MarkflyHTTPSResponse response);
int markfly_openat(int directory, const char *name, int flags, unsigned short mode);

#endif
