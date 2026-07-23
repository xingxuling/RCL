CC ?= cc
CFLAGS ?= -O2 -std=c11 -Wall -Wextra -Wpedantic
PICFLAGS ?= -fPIC
LDFLAGS ?= -lcrypto -lm
TARGET := rclvm
SERVER := rclvmd
COMPILER := rclc
PROVIDER_DEMO := provider_demo
FOUNDATION_PROVIDER := rclfoundation
EMBEDDED_BENCHMARK := embedded_benchmark
STATIC_LIB := librclvm.a
SHARED_LIB := librclvm.so
SOURCE := rclvm.c
OBJECT := rclvm.o

all: $(TARGET) $(STATIC_LIB) $(SHARED_LIB) $(SERVER) $(COMPILER) $(PROVIDER_DEMO) $(FOUNDATION_PROVIDER) $(EMBEDDED_BENCHMARK)

$(OBJECT): $(SOURCE) rclvm.h
	$(CC) $(CFLAGS) $(PICFLAGS) -DRCLVM_EMBEDDED_ONLY -c -o $@ $(SOURCE)

$(TARGET): $(SOURCE) rclvm.h
	$(CC) $(CFLAGS) -o $@ $(SOURCE) $(LDFLAGS)

$(STATIC_LIB): $(OBJECT)
	ar rcs $@ $(OBJECT)

$(SHARED_LIB): $(OBJECT)
	$(CC) -shared -o $@ $(OBJECT) $(LDFLAGS)

$(SERVER): rclvmd.c $(STATIC_LIB) rclvm.h
	$(CC) $(CFLAGS) -o $@ rclvmd.c $(STATIC_LIB) $(LDFLAGS)

$(COMPILER): rclc.c $(STATIC_LIB) rclvm.h
	$(CC) $(CFLAGS) -o $@ rclc.c $(STATIC_LIB) $(LDFLAGS)

$(PROVIDER_DEMO): provider_demo.c $(STATIC_LIB) rclvm.h
	$(CC) $(CFLAGS) -o $@ provider_demo.c $(STATIC_LIB) $(LDFLAGS)

$(FOUNDATION_PROVIDER): foundation_provider.c $(STATIC_LIB) rclvm.h
	$(CC) $(CFLAGS) -o $@ foundation_provider.c $(STATIC_LIB) $(LDFLAGS)

$(EMBEDDED_BENCHMARK): embedded_benchmark.c $(STATIC_LIB) rclvm.h
	$(CC) $(CFLAGS) -o $@ embedded_benchmark.c $(STATIC_LIB) $(LDFLAGS)

clean:
	rm -f $(TARGET) $(SERVER) $(COMPILER) $(PROVIDER_DEMO) $(FOUNDATION_PROVIDER) $(EMBEDDED_BENCHMARK) $(OBJECT) $(STATIC_LIB) $(SHARED_LIB)
