---
title: 关于UUID的简单研究
date: 2024-07-16 17:25:28
tags: RFC标准
---

<meta name="referrer" content="no-referrer"/>

# 1.基本介绍

UUID（Universally Unique Identifier），中文名为“通用唯一识别码”，目的是让分布式系统中的所有元素都能有唯一的辨识信息，而不需要通过中央控制端来做辨识信息的指定，这样每个人都可以创建不与其它人冲突的UUID。RFC 4122文档规定了规范版本的UUID，另外还有微软使用的GUID等。本文将研究RFC 4122文档规定的UUID。

# 2.RFC文档规定的UUID格式以及版本

RFC文档规定，UUID是一个32位的16进制数，长度为16字节(128 bit)，一般表示为{hhhhhhhh-hhhh-Mhhh-Nhhh-hhhhhhhhhhhh}即{8-4-4-4-12}的标准格式。十六进制位M表示UUID版本，在RFC规范下M可选值为1,2,3,45；十六进制N表示UUID变体，该位固定为10xx，因此可选值为8，9，a，b。RFC 4122规定了5个版本的UUID实现算法，即V1,V2,V3,V4,V5。它们各自的特点如下：

UUID V1：基于时间的UUID

基于时间的UUID通过计算当前时间戳、随机数和机器MAC地址得到。由于在算法中使用了MAC地址，这个版本的UUID可以保证在全球范围的唯一性。但与此同时，使用MAC地址会带来安全性问题，这就是这个版本UUID受到批评的地方。如果应用只是在局域网中使用，也可以使用退化的算法，以IP地址来代替MAC地址。

UUID V2：DCE安全的UUID

DCE（Distributed Computing Environment）安全的UUID和基于时间的UUID V1算法相同，但会把时间戳的前4位置换为POSIX的UID或GID。这个版本的UUID在实际中较少用到。

UUID V3：基于名字空间与给定字符串构造的UUID（MD5）

通过计算名字空间与给定字符串的MD5散列值得到，其中名字空间是由标准规定的一个16字节值。这个版本的UUID保证了：相同名字空间中不同字符串生成的UUID的唯一性；不同名字空间中的UUID的唯一性；相同名字空间中相同字符串的UUID重复生成是相同的。

UUID V4：随机UUID

根据随机数，或者伪随机数生成UUID。

UUID V5：基于名字空间与给定字符串构造的UUID（SHA1）

和UUID V3算法类似，只是散列值计算使用SHA1算法。

除此之外，还有一个特殊种类的UUID：Nil UUID，各位均为0，即{00000000-0000-0000-0000000000000000}。

# 3.MD5和SHA1

## 3.1 MD5

MD5信息摘要算法（英语：MD5 Message-Digest Algorithm），一种被广泛使用的密码散列函数，用于确保信息传输完整一致。这套算法的程序在 RFC 1321 标准中被加以规范。MD5算法将输入的信息每512位(64字节)分为一组，特别地，最后一组为448位数据内容+64位数据长度信息，不足的部分按一定规则填充；经过一系列的处理，算法的输出由四个32位分组组成，将这四个32位分组级联后将生成一个128位(16字节)的MD5散列值，这个散列值也称为摘要(digest)。

在代码实现层面，MD5算法实现为LMd5类，有以下数据成员：

```cpp
/**
 * @brief 记录输入数据的位数。
 */
unsigned int m_count[2];

/**
 * @brief 记录散列值在算法处理过程中的状态。
 */
unsigned int m_state[4];

/**
 * @brief 在对输入数据分组的过程中处理最后一组( 448 位数据 + 64 位数据长度信息)。
 */
unsigned char m_buffer[64];
```

需要两个辅助函数：

```cpp
/**
 * @brief 将字节数据转换为 uint32_t 。
 */
void decode(unsigned int *output, const unsigned char *input, unsigned int len)
{
    for (unsigned int i = 0, j = 0; j < len; i++, j += 4)
    {
        output[i] = ((unsigned int)input[j]) | (((unsigned int)input[j + 1]) << 8) | (((unsigned int)input[j + 2]) << 16) | (((unsigned int)input[j + 3]) << 24);
    }
}

/**
 * @brief 将 uint32_t 转换为字节数据。
 */
void encode(unsigned char *output, const unsigned int *input, unsigned int len)
{
    for (unsigned int i = 0, j = 0; j < len; i++, j += 4)
    {
        output[j] = input[i] & 0xff;
        output[j + 1] = (input[i] >> 8) & 0xff;
        output[j + 2] = (input[i] >> 16) & 0xff;
        output[j + 3] = (input[i] >> 24) & 0xff;
    }
}
```

算法具体的功能实现分为三个步骤：

第一步是初始化(Init)，按照标准规定对散列值的状态进行初始化：

```cpp
void LMd5::init()
{
    m_count[0] = 0;
    m_count[1] = 0;
    m_state[0] = 0x67452301;
    m_state[1] = 0xefcdab89;
    m_state[2] = 0x98badcfe;
    m_state[3] = 0x10325476;

    memset(m_buffer, 0, 64);
}
```

第二步是算法运行(Update)，处理输入数据并运行MD5算法，需要注意的是，该步骤会以输入数据流的形式处理所有的输入数据：在Update步骤中可能会多次接收输入数据，而该对象会将这些数据作为同一组数据流来看待。例如，在该步骤中先后输入了长度分别为524bit,1036bit的数据，则它们等同于一组长度为1560bit的数据，其内容按照不同输入数据的前后次序无缝拼接。在同一个对象中，上述Update步骤会一直到后面的Final步骤才会结束：

```cpp
void LMd5::update(const unsigned char *data, std::size_t size)
{
    // 计算已处理的数据中占据了"最后一组"的字节数
    unsigned int index = (m_count[0] >> 3) & 0x3F; //(count[0]/8) % BLOCKSIZE
    // 更新数据长度计数器count,注意,count中的长度以bit位为单位,而size以字节为单位,需要乘以8
    if ((m_count[0] += (size << 3)) < (size << 3))
    {
        m_count[1]++;
    }

    // 处理加法溢出
    m_count[1] += (size >> 29);
    // 计算buffer中的剩余空间
    unsigned int firstPart = 64 - index;
    // 在输入数据中尽可能多的数据块上运行MD5算法
    unsigned int i = 0;
    if (size >= firstPart)
    {
        // fill buffer first, transform
        memcpy(m_buffer + index, data, firstPart);
        transform(m_buffer);
        data += firstPart;
        // transform chunks of blocksize (64 bytes)
        for (i = firstPart; i + 64 <= size; i += 64)
        {
            transform(data);
            data += 64;
        }
        index = 0;
    }
    else
        i = 0;

    // 将未处理的输入数据部分缓存在buffer中
    memcpy(m_buffer + index, data, size - i);
}
```



第三步是得到最终结果(Final)，获取最终的MD5散列结果，并重置本对象。此步骤同时标志着Update步骤中输入数据流的终止，若再输入数据时将会重新开始输入数据流与算法运行过程。

```cpp
void LMd5::final(unsigned char *result)
{
    unsigned int used, available;

    used = (m_count[0] >> 3) & 0x3f;

    m_buffer[used++] = 0x80;

    available = 64 - used;

    if (available < 8)
    {
        memset(&m_buffer[used], 0, available);
        transform(m_buffer);
        used = 0;
        available = 64;
    }

    memset(&m_buffer[used], 0, available - 8);

    encode(&m_buffer[56], &m_count[0], (unsigned int)4);
    encode(&m_buffer[60], &m_count[1], (unsigned int)4);

    transform(m_buffer);

    encode(&result[0], &m_state[0], (unsigned int)4);
    encode(&result[4], &m_state[1], (unsigned int)4);
    encode(&result[8], &m_state[2], (unsigned int)4);
    encode(&result[12], &m_state[3], (unsigned int)4);
}
```

在具体算法上，MD5标准首先规定了以下几种形式的位运算：

```cpp
/**
 * @brief MD5 标准算法的中间函数 F 。
 */
unsigned int md5F(unsigned int x, unsigned int y, unsigned int z) { return x & y | ~x & z; }

/**
 * @brief MD5 标准算法的中间函数 G 。
 */
unsigned int md5G(unsigned int x, unsigned int y, unsigned int z) { return x & z | y & ~z; }

/**
 * @brief MD5 标准算法的中间函数 H 。
 */
unsigned int md5H(unsigned int x, unsigned int y, unsigned int z) { return x ^ y ^ z; }

/**
 * @brief MD5 标准算法的中间函数 I 。
 */
unsigned int md5I(unsigned int x, unsigned int y, unsigned int z) { return y ^ (x | ~z); }

/**
 * @brief 左循环移位操作。
 */
unsigned int rotateLeft(unsigned int x, int n) { return (x << n) | (x >> (32 - n)); }

/**
 * @brief MD5 标准算法的处理函数 FF 。
 */
void md5FF(unsigned int &a, unsigned int b, unsigned int c, unsigned int d, unsigned int x, unsigned int s, unsigned int ac) { a = rotateLeft(a + md5F(b, c, d) + x + ac, s) + b; }

/**
 * @brief MD5 标准算法的处理函数 GG 。
 */
void md5GG(unsigned int &a, unsigned int b, unsigned int c, unsigned int d, unsigned int x, unsigned int s, unsigned int ac) { a = rotateLeft(a + md5G(b, c, d) + x + ac, s) + b; }

/**
 * @brief MD5 标准算法的处理函数 HH 。
 */
void md5HH(unsigned int &a, unsigned int b, unsigned int c, unsigned int d, unsigned int x, unsigned int s, unsigned int ac) { a = rotateLeft(a + md5H(b, c, d) + x + ac, s) + b; }

/**
 * @brief MD5 标准算法的处理函数 II 。
 */
void md5II(unsigned int &a, unsigned int b, unsigned int c, unsigned int d, unsigned int x, unsigned int s, unsigned int ac) { a = rotateLeft(a + md5I(b, c, d) + x + ac, s) + b; }
```

transform函数运算获得每个数据块block的散列值，block的长度按照标准须为64字节(512位)。

```cpp
void LMd5::transform(const unsigned char block[64])
{
    unsigned int a = m_state[0], b = m_state[1], c = m_state[2], d = m_state[3], x[16] = {0};

    decode(x, block, 64);
    /* Round 1 */
    md5FF(a, b, c, d, x[0], 7, 0xd76aa478);   /* 1 */
    md5FF(d, a, b, c, x[1], 12, 0xe8c7b756);  /* 2 */
    md5FF(c, d, a, b, x[2], 17, 0x242070db);  /* 3 */
    md5FF(b, c, d, a, x[3], 22, 0xc1bdceee);  /* 4 */
    md5FF(a, b, c, d, x[4], 7, 0xf57c0faf);   /* 5 */
    md5FF(d, a, b, c, x[5], 12, 0x4787c62a);  /* 6 */
    md5FF(c, d, a, b, x[6], 17, 0xa8304613);  /* 7 */
    md5FF(b, c, d, a, x[7], 22, 0xfd469501);  /* 8 */
    md5FF(a, b, c, d, x[8], 7, 0x698098d8);   /* 9 */
    md5FF(d, a, b, c, x[9], 12, 0x8b44f7af);  /* 10 */
    md5FF(c, d, a, b, x[10], 17, 0xffff5bb1); /* 11 */
    md5FF(b, c, d, a, x[11], 22, 0x895cd7be); /* 12 */
    md5FF(a, b, c, d, x[12], 7, 0x6b901122);  /* 13 */
    md5FF(d, a, b, c, x[13], 12, 0xfd987193); /* 14 */
    md5FF(c, d, a, b, x[14], 17, 0xa679438e); /* 15 */
    md5FF(b, c, d, a, x[15], 22, 0x49b40821); /* 16 */
    /* Round 2 */
    md5GG(a, b, c, d, x[1], 5, 0xf61e2562);   /* 17 */
    md5GG(d, a, b, c, x[6], 9, 0xc040b340);   /* 18 */
    md5GG(c, d, a, b, x[11], 14, 0x265e5a51); /* 19 */
    md5GG(b, c, d, a, x[0], 20, 0xe9b6c7aa);  /* 20 */
    md5GG(a, b, c, d, x[5], 5, 0xd62f105d);   /* 21 */
    md5GG(d, a, b, c, x[10], 9, 0x2441453);   /* 22 */
    md5GG(c, d, a, b, x[15], 14, 0xd8a1e681); /* 23 */
    md5GG(b, c, d, a, x[4], 20, 0xe7d3fbc8);  /* 24 */
    md5GG(a, b, c, d, x[9], 5, 0x21e1cde6);   /* 25 */
    md5GG(d, a, b, c, x[14], 9, 0xc33707d6);  /* 26 */
    md5GG(c, d, a, b, x[3], 14, 0xf4d50d87);  /* 27 */
    md5GG(b, c, d, a, x[8], 20, 0x455a14ed);  /* 28 */
    md5GG(a, b, c, d, x[13], 5, 0xa9e3e905);  /* 29 */
    md5GG(d, a, b, c, x[2], 9, 0xfcefa3f8);   /* 30 */
    md5GG(c, d, a, b, x[7], 14, 0x676f02d9);  /* 31 */
    md5GG(b, c, d, a, x[12], 20, 0x8d2a4c8a); /* 32 */
    /* Round 3 */
    md5HH(a, b, c, d, x[5], 4, 0xfffa3942);   /* 33 */
    md5HH(d, a, b, c, x[8], 11, 0x8771f681);  /* 34 */
    md5HH(c, d, a, b, x[11], 16, 0x6d9d6122); /* 35 */
    md5HH(b, c, d, a, x[14], 23, 0xfde5380c); /* 36 */
    md5HH(a, b, c, d, x[1], 4, 0xa4beea44);   /* 37 */
    md5HH(d, a, b, c, x[4], 11, 0x4bdecfa9);  /* 38 */
    md5HH(c, d, a, b, x[7], 16, 0xf6bb4b60);  /* 39 */
    md5HH(b, c, d, a, x[10], 23, 0xbebfbc70); /* 40 */
    md5HH(a, b, c, d, x[13], 4, 0x289b7ec6);  /* 41 */
    md5HH(d, a, b, c, x[0], 11, 0xeaa127fa);  /* 42 */
    md5HH(c, d, a, b, x[3], 16, 0xd4ef3085);  /* 43 */
    md5HH(b, c, d, a, x[6], 23, 0x4881d05);   /* 44 */
    md5HH(a, b, c, d, x[9], 4, 0xd9d4d039);   /* 45 */
    md5HH(d, a, b, c, x[12], 11, 0xe6db99e5); /* 46 */
    md5HH(c, d, a, b, x[15], 16, 0x1fa27cf8); /* 47 */
    md5HH(b, c, d, a, x[2], 23, 0xc4ac5665);  /* 48 */
    /* Round 4 */
    md5II(a, b, c, d, x[0], 6, 0xf4292244);   /* 49 */
    md5II(d, a, b, c, x[7], 10, 0x432aff97);  /* 50 */
    md5II(c, d, a, b, x[14], 15, 0xab9423a7); /* 51 */
    md5II(b, c, d, a, x[5], 21, 0xfc93a039);  /* 52 */
    md5II(a, b, c, d, x[12], 6, 0x655b59c3);  /* 53 */
    md5II(d, a, b, c, x[3], 10, 0x8f0ccc92);  /* 54 */
    md5II(c, d, a, b, x[10], 15, 0xffeff47d); /* 55 */
    md5II(b, c, d, a, x[1], 21, 0x85845dd1);  /* 56 */
    md5II(a, b, c, d, x[8], 6, 0x6fa87e4f);   /* 57 */
    md5II(d, a, b, c, x[15], 10, 0xfe2ce6e0); /* 58 */
    md5II(c, d, a, b, x[6], 15, 0xa3014314);  /* 59 */
    md5II(b, c, d, a, x[13], 21, 0x4e0811a1); /* 60 */
    md5II(a, b, c, d, x[4], 6, 0xf7537e82);   /* 61 */
    md5II(d, a, b, c, x[11], 10, 0xbd3af235); /* 62 */
    md5II(c, d, a, b, x[2], 15, 0x2ad7d2bb);  /* 63 */
    md5II(b, c, d, a, x[9], 21, 0xeb86d391);  /* 64 */

    m_state[0] += a;
    m_state[1] += b;
    m_state[2] += c;
    m_state[3] += d;
}
```

## 3.2 SHA1

SHA1（英语：Secure Hash Algorithm 1，中文名：安全散列算法1）是一种密码散列函数，美国国家安全局设计，并由美国国家标准技术研究所（NIST）发布为联邦数据处理标准（FIPS）。SHA-1可以生成一个的160位（20字节）散列值，散列值通常的呈现形式为40个十六进制数，这个散列值也称为摘要(digest)。SHA1算法对输入数据采用与MD5相同的方式进行分组，不过分组之后SHA1算法会按照一定规则将每组数据扩展为80个32字节的小分组数据。

在代码实现层面，SHA1算法实现为LSha1类，有以下数据成员：

```cpp
/**
 * @brief 记录散列值在算法处理过程中的状态。
 */
unsigned int m_state[5];

/**
 * @brief 在对输入数据分组的过程中处理最后一组( 448 位数据 + 64 位数据长度信息)。
 */
unsigned char m_buffer[64];

/**
 * @brief 记录输入数据的位数。
 */
unsigned int m_count[2];
```

同时需要RotateLeft和encode辅助函数，与LMd5当中的对应函数相同。

算法具体的功能实现分为三个步骤：

第一步是初始化(Init)，按照标准规定对散列值的状态进行初始化：

```cpp
void LSha1::init()
{
    m_state[0] = 0x67452301;
    m_state[1] = 0xEFCDAB89;
    m_state[2] = 0x98BADCFE;
    m_state[3] = 0x10325476;
    m_state[4] = 0xC3D2E1F0;
    m_count[0] = 0;
    m_count[1] = 0;
    memset(m_buffer, 0, 64);
}
```



第二步是算法运行(Update)，处理输入数据并运行SHA1算法，需要注意的是，该步骤会以输入数据流的形式处理所有的输入数据：在Update步骤中可能会多次接收输入数据，而该对象会将这些数据作为同一组数据流来看待。例如，在该步骤中先后输入了长度分别为524bit,1036bit的数据，则它们等同于一组长度为1560bit的数据，其内容按照不同输入数据的前后次序无缝拼接，这与MD5中的做法一致。在同一个对象中，上述Update步骤会一直到后面的Final步骤才会结束：

```cpp
void LSha1::update(const unsigned char *data, std::size_t size)
{
    // 计算已处理的数据中占据了"最后一组"的字节数
    unsigned int index = (m_count[0] >> 3) & 0x3F; //(count[0]/8) % BLOCKSIZE(64)
    // 更新数据长度计数器count,注意,count中的长度以bit位为单位,而size以字节为单位,需要乘以8
    if ((m_count[0] += (size << 3)) < (size << 3)) // 处理加法溢出
        m_count[1]++;
    m_count[1] += (size >> 29);
    // 计算buffer中的剩余空间
    unsigned int firstPart = 64 - index;
    // 在输入数据中尽可能多的数据块上运行SHA1算法
    unsigned int i = 0;
    if (size >= firstPart)
    {
        // fill buffer first, transform
        memcpy(m_buffer + index, data, firstPart);
        transform(m_buffer);
        data += firstPart;
        // transform chunks of blocksize (64 bytes)
        for (i = firstPart; i + 64 <= size; i += 64)
        {
            transform(data);
            data += 64;
        }
        index = 0;
    }
    else
        i = 0;
    // 将未处理的输入数据部分缓存在buffer中
    memcpy(m_buffer + index, data, size - i);
}
```

第三步是得到最终结果(Final)，获取最终的SHA1散列结果，并重置本对象。此步骤同时标志着Update步骤中输入数据流的终止，若再输入数据时将会重新开始输入数据流与算法运行过程。

```cpp
void LSha1::final(unsigned char *result)
{
    unsigned int used, available;

    used = (m_count[0] >> 3) & 0x3f;

    m_buffer[used++] = 0x80;

    available = 64 - used;

    if (available < 8)
    {
        memset(&m_buffer[used], 0, available);
        transform(m_buffer);
        used = 0;
        available = 64;
    }

    memset(&m_buffer[used], 0, available - 8);

    encode(&m_buffer[56], &m_count[1], (unsigned int)4);
    encode(&m_buffer[60], &m_count[0], (unsigned int)4);

    transform(m_buffer);

    encode(&result[0], &m_state[0], (unsigned int)4);
    encode(&result[4], &m_state[1], (unsigned int)4);
    encode(&result[8], &m_state[2], (unsigned int)4);
    encode(&result[12], &m_state[3], (unsigned int)4);
    encode(&result[16], &m_state[4], (unsigned int)4);
}
```

transform函数运算获得每个数据块block的散列值，block的长度按照标准须为64字节(512位)。

```cpp
void LSha1::transform(const unsigned char block[64])
{
    unsigned int a = m_state[0], b = m_state[1], c = m_state[2], d = m_state[3], e = m_state[4], tmp = 0, w[80] = {0};
    unsigned int i;
    for (i = 0; i < 16; i++)
    {
        w[i] = ((unsigned int)block[i * 4] << 24) | (((unsigned int)block[i * 4 + 1]) << 16) |
               (((unsigned int)block[i * 4 + 2]) << 8) | (((unsigned int)block[i * 4 + 3]) << 0);
    }
    for (i = 16; i < 80; i++)
    {
        tmp = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
        w[i] = RotateLeft(tmp, 1);
    }

    for (i = 0; i < 80; i++)
    {
        switch (i / 20)
        {
            case 0:
                tmp = RotateLeft(a, 5) + ((b & c) | (d & ~b)) + e + w[i] + 0x5a827999;
                break;
            case 1:
                tmp = RotateLeft(a, 5) + (b ^ c ^ d) + e + w[i] + 0x6ed9eba1;
                break;
            case 2:
                tmp = RotateLeft(a, 5) + ((b & c) | (b & d) | (c & d)) + e + w[i] + 0x8f1bbcdc;
                break;
            case 3:
                tmp = RotateLeft(a, 5) + (b ^ c ^ d) + e + w[i] + 0xca62c1d6;
                break;
        }
        e = d;
        d = c;
        c = RotateLeft(b, 30);
        b = a;
        a = tmp;
    }
    m_state[0] += a;
    m_state[1] += b;
    m_state[2] += c;
    m_state[3] += d;
    m_state[4] += e;
}
```

# 4.UUID模块的简单实现

下文将重点讲述LUuid类对V3、V4、V5版本的UUID生成的方式，以及UUID模块的其他重要功能。

## 4.1 LUuid类

LUuid类具有以下数据成员和枚举：

```cpp
/**
 * @brief 保存一个 UUID 。
 */
unsigned char m_data[16] = {0};
/**
 * @enum Names
 * @brief 枚举可选的名字空间。
 */
enum Names
{
    Dns, ///< {6ba7b810-9dad-11d1-80b4-00c04fd430c8}
    Url, ///< {6ba7b811-9dad-11d1-80b4-00c04fd430c8}
    Oid, ///< {6ba7b812-9dad-11d1-80b4-00c04fd430c8}
    X500 ///< {6ba7b814-9dad-11d1-80b4-00c04fd430c8}
};

/**
 * @enum VariantType
 * @brief 枚举可选的变体类型。
 */
enum VariantType
{
    Ncs,       ///< NCS backward compatibility
    Rfc4122,   ///< defined in RFC 4122 document
    Microsoft, ///< Microsoft Corporation backward compatibility
    Future     ///< future definition
};

/**
 * @enum Version
 * @brief 枚举可选的版本信息。
 */
enum Version
{
    Nil = 0,     ///< Nil 版本
    V1 = 1,      ///< 版本 1
    V2 = 2,      ///< 版本 2
    V3 = 3,      ///< 版本 3
    V4 = 4,      ///< 版本 4
    V5 = 5,      ///< 版本 5
    Unknown = -1 ///< 未知版本
};
```

V3/V5版本的UUID实现如下。其中，V5版本使用的SHA1算法会生成20字节的散列值，但是UUID只取前16个字节。

```cpp
void uuidV3(unsigned char result[16], unsigned char nsid[16], const LString &name)
{
    LMd5 c;
    LByteArray hash;
    auto strData = name.toStdString();
    auto data = strData.c_str();
    c.process((unsigned char *)nsid, 16 * sizeof(unsigned char));
    c.process((unsigned char *)data, (size_t)name.byteCount());
    hash = c.getDigest();
    formatUuidV35(result, (unsigned char *)hash.data(), (unsigned char)3);
}
void uuidV5(unsigned char result[16], unsigned char nsid[16], const LString &name)
{
    LSha1 c;
    LByteArray hash;
    auto strData = name.toStdString();
    auto data = strData.c_str();
    c.process((unsigned char *)nsid, 16 * sizeof(unsigned char));
    c.process((unsigned char *)data, (size_t)name.byteCount());
    hash = c.getDigest();
    formatUuidV35(result, (unsigned char *)hash.data(), (unsigned char)5);
}
void formatUuidV35(unsigned char result[16], unsigned char hash[16], unsigned char version)
{
    memcpy(result, hash, size());
    result[6] &= 0x0F;
    result[6] |= (version << 4);
    result[8] &= 0x3F;
    result[8] |= 0x80;
}
```

V4版本的UUID实现如下：

```cpp
void uuidV4(unsigned char result[16])
{
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> distrib(0x00, 0xFF);
    unsigned char *randoms = new unsigned char[16];
    for (int i = 0; i < 16; i++)
    {
        randoms[i] = (unsigned char)distrib(gen);
    }
    memcpy(result, randoms, (size_t)size());
    result[6] &= 0x0F;
    result[6] |= 0x40;
    result[8] &= 0x3F;
    result[8] |= 0x80;
}
```

V4版本的UUID不使用经典C的rand函数，而使用了C++的random标准库中的方法进行实现。

## 4.2 重要功能——fromString

```cpp
bool LUuid::fromString(const LString &str)
{
    size_t len = str.length();
    char *ch = new char[len + 1];
    memset(ch, 0, len + 1);
    str.toCharArray(ch);

    bool hasOpenBrace = ('{' == ch[0]);
    bool hasDashes = false;
    size_t j = 0;

    if (hasOpenBrace)
    {
        j++;
    }

    for (std::size_t i = 0; i < size(); i++, j++)
    {
        if (j > len)
        {
            delete[] ch;
            ch = nullptr;
            return false;
        }

        char c = ch[j];
        if (4 == i)
        {
            hasDashes = ('-' == c);
            if (hasDashes)
            {
                j++;
                c = ch[j];
            }
        }
        else if ((6 == i || 8 == i || 10 == i) && hasDashes)
        {
            if ('-' == c)
            {
                j++;
                c = ch[j];
            }
            else
            {
                delete[] ch;
                ch = nullptr;
                return false;
            }
        }

        m_data[i] = getHexVal(c);
        j++;
        c = ch[j];
        m_data[i] <<= 4;
        m_data[i] |= getHexVal(c);
    }

    if (hasOpenBrace && '}' != ch[j])
    {
        delete[] ch;
        ch = nullptr;
        return false;
    }

    delete[] ch;
    ch = nullptr;

    return true;
}
```



该函数将符合特定格式的字符串转换为Uuid，并将其保存在当前的LUuid对象中。

该函数的str参数输入的字符串格式应当能够匹配下列正则表达式：

^({)?([0-9a-fA-F]{8})(?-)?([0-9a-fA-F]{4})(?(DASH)-)([0-9a-fA-F]{4})(?(DASH)-)([0-9a-fA-F]{4})(?(DASH)-)([0-9a-fA-F]{12})(?(1)})$

若非法输入会返回false，同时本对象中保存的UUID不会被改变。

具体来说，该方法在字符串转换为Uuid的过程中为以下技术问题提供了一个方案：

(1)如何验证输入的字符串的长度与有效的十六进制位数合法?输入字符串的长度可能因为大括号、破折号等出现不确定，但是转换成的UUID长度总是确定的，即16个字节。所以，在读取字符串内容时，设置两个计数器i和j，其中i用于读取字符串的内容，而j则用于转换后的UUID当中对所在十六进制位的计数，在验证输入字符串的长度与有效位数时，我们不关心i如何，而是对j进行验证，因为j最后所达到的值是确定的。

(2)如何验证输入的字符串的格式合法?这里的问题与解决方案的思想都与(1)类似：输入字符串中的大括号、破折号的位置可能因为具体格式的不同出现不确定，但是UUID当中在哪些十六进制位的旁边出现的大括号和破折号可以视为合法，这是确定的！涉及到UUID当中十六进制位的位置计数，同样可以采用(1)中的两个计数器的方式，i读取字符串的内容，验证时不去关心，而是对j进行验证——例如，假设该字符串中有破折号，那么在读取到时，便设置一个布尔值“hasDashes”为真；每当j累加到“允许出现”破折号的位置，同时“hasDashes”为真，那么便会检查字符串中当前对应的位置是否为破折号，当然，这里就用到i来获取字符串中的对应位置字符了。
