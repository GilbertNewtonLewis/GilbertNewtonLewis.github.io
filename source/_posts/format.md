---
title: LString::format
date: 2024-07-17 10:46:13
updated: 2024-07-17 10:46:13
---

<meta name="referrer" content="no-referrer"/>

# 1.前言

字符串格式化是非常广泛的需求。对比C++格式化输出的几种方法：

(1)printf 类格式化输出

C 标准库中的 `printf` 类函数, 实际上是非常广泛使用的。他们主要的问题是不安全 (既不类型安全, 也可能造成缓冲区的溢出), 以及无法拓展 (无法兼容更多类型)。

(2)C++ 的流式 I/O

`cout` 之类的做到了类型安全, 也做到了拓展性, 但使用起来比较麻烦。而就其实现上来说, 效率也并不见得高。

如果想输出一个浮点数并保留小数点之后 3 位, `printf` 只需要 `%.3f`, 而 `cout` 需要：

```cpp
#include <iomanip>
#include <iostream>
std::cout << std::setiosflags(std::ios::fixed) << std::setprecision(3) << 0.;
```

这使用起来很麻烦. 更不要说如果你想格式化 5 个参数, 就可能要输入 10 个 `<<` 操作符了。

(3)fmtlib/std::format

鉴于传统C++格式化方法的局限性，`fmtlib`被开发出来，并在C++20标准中被引入为`std::format`库，旨在提供一种更现代、更安全、更灵活的格式化方法。引入它们的主要动机包括：

1. **提高可读性**：`fmtlib/std::format`采用了一种更加简洁、易懂的语法，使得格式化字符串更具可读性。
2. **增强类型安全**：`fmtlib/std::format`在编译期间就可以检查参数类型的正确性，从而降低运行时错误的风险。
3. **扩展功能**：`fmtlib/std::format`支持自定义类型的格式化，同时兼容宽字符和多字节字符集。这使得开发人员能够满足更为复杂的格式化需求。
4. **性能优化**：`fmtlib/std::format`设计时充分考虑了性能问题，相比传统的格式化方法，它在许多场景下能够提供更高的性能。

总之，`fmtlib/std::format`旨在解决传统C++格式化方法的问题，并为开发者提供一种更现代、更安全、更灵活的格式化工具。

<!-- more -->

# 2.LString::format

LString::format基于LarkSDK的字符串类LString，旨在提供一种对标fmtlib/std::format的现代的C++字符串格式化方法。

字符串格式化的最主要过程就是处理占位符，LString中的segmentReplace方法为处理占位符提供了极大的方便：

```cpp
/**
 * @struct LString::ReplaceSlotStruct
 * @brief 用于字符串替换操作（包括格式化操作时发生的替换）过程中记录待替换的字符串片段位置。
 */
struct ReplaceSlotStruct
{
    int pos = 0;                                                                 ///< 片段的起始位置
    int len = 0;                                                                 ///< 片段长度
    int ref = 0;                                                                 ///< 替换目标字符串在待替换表中的索引
    ReplaceSlotStruct(int pos, int len, int ref) : pos(pos), len(len), ref(ref) {} ///< 构造函数
};
/**
 * @brief 执行片段替换。从替换片段位置表中逐个获取片段的位置和替换目标字符串索引，根据索引从待替换字符串表中获取目标字符串以完成替换。
 * @details 替换时可能涉及到字符串长度的改变和容器扩容，算法将根据替换片段清单预先计算替换后字符串的长度，尝试进行最高效率的内存分配。
 * @param slots 片段位置和长度清单
 * @param values 替换目标字符串清单
 */
void segmentReplace(const LVector<ReplaceSlotStruct> &slots, const LVector<LString> &values);
```

segmentReplace方法实现"片段替换"，它将待替换表values中的每个LString片段替换到this对象的“格式化槽”slots中的对应位置(由ReplaceSlotStruct指定)。

所以LString在处理格式化字符串时，只要在找到每个占位符作为slots、获取每个输入参数转换为LString作为values后调用segmentReplace方法即可。

format函数原型如下：

```cpp
/**
 * @brief 将字符串作为格式化模板，传入参数进行格式化。输出格式化完成后的结果为新字符串。
 * @param args 参数清单
 * @return 格式化结果
 */
template <typename... Args>
LString format(const Args &...args);
```

## 2.1 获取输入参数

getArg方法获取输入参数。

```cpp
template <typename T>
LVector<LString> LString::getArg(const T &t)
{
    LVector<LString> res;
    res.append(LString::fromValue(t));
    return res;
}
template <typename T, typename... Args>
LVector<LString> LString::getArg(const T &t, const Args &...args)
{
    LVector<LString> res = getArg(args...);
    res.prepend(LString::fromValue(t));
    return res;
}
```

getArg通过递归调用的方式，将形参包“...args”展开并保存到LVector中返回。

## 2.2 输入参数统一成LString

fromValue方法在getArg方法当中被调用，将输入参数统一成LString。

```cpp
/**
 * @brief 将 T 类型的值转换为字符串，通常在格式化等场合调用。
 * @details 通过模板特化特化 T 具体实现不同类型的转换。未特化实现的类型为不支持类型。
 * @tparam T 类型
 * @param value 值
 * @return 转换后的字符串
 */
template <typename T>
static LString fromValue(const T &value);
```

fromValue方法对以下类型实现了特化：

```cpp
// 未特化的类型不支持,返回空对象
template <typename T>
inline LString LString::fromValue(const T &value)
{
    return LString();
}

template <>
inline LString LString::fromValue(const bool &value)
{
    if (value)
    {
        return LString("True");
    }
    else
    {
        return LString("False");
    }
}

template <>
inline LString LString::fromValue(const char &value)
{
    return LString(LChar(value));
}

template <>
inline LString LString::fromValue(const unsigned char &value)
{
    return LString(LChar(value));
}

template <>
inline LString LString::fromValue(const short &value)
{
    return LString::fromInt(value);
}

template <>
inline LString LString::fromValue(const unsigned short &value)
{
    return LString::fromInt(value);
}

template <>
inline LString LString::fromValue(const int &value)
{
    return LString::fromInt(value);
}

template <>
inline LString LString::fromValue(const unsigned int &value)
{
    return LString::fromInt(value);
}

template <>
inline LString LString::fromValue(const long &value)
{
    return LString::fromInt(value);
}

template <>
inline LString LString::fromValue(const unsigned long &value)
{
    return LString::fromInt(value);
}

template <>
inline LString LString::fromValue(const long long &value)
{
    return LString::fromInt(value);
}

template <>
inline LString LString::fromValue(const unsigned long long &value)
{
    return LString::fromInt(value);
}

template <>
inline LString LString::fromValue(const float &value)
{
    return LString::fromReal(value);
}

template <>
inline LString LString::fromValue(const double &value)
{
    return LString::fromReal(value);
}

template <>
inline LString LString::fromValue(const long double &value)
{
    return LString::fromReal(value);
}

template <>
inline LString LString::fromValue(const LString &value)
{
    return LString(value);
}

template <>
inline LString LString::fromValue(const LChar &value)
{
    return LString(value);
}

template <typename T>
inline LString LString::fromValue(T *value)
{
    // 普通的指针类型直接返回地址
    return LString("0x") << LString::fromInt((unsigned long long)value, 16);
}

template <>
inline LString LString::fromValue(const char *value)
{
    return LString(value);
}
```

## 2.3 format方法定义

```cpp
template <typename... Args>
LString LString::format(const Args &...args)
{

    static const auto openBrace = LChar("{").unicode();
    static const auto closeBrace = LChar("}").unicode();
    // 用作记录处理过程信息的状态位
    constexpr uint32_t slotStarted = 0b1;
    constexpr uint32_t slotFinish = ~slotStarted;
    constexpr uint32_t firstSlotPassed = 0b1 << 1;
    constexpr uint32_t isOrderMode = 0b1 << 2;
    // 初始化。initArgs使用前3个位置，作为空slot、左大括号转义"{{"、右大括号转义"}}"的替换对象。
    static LVector<LString> initArgs{LString(), LString("{"), LString("}")};
    constexpr size_t nullSlot = 0;
    constexpr size_t openBraceSlot = 1;
    constexpr size_t closeBraceSlot = 2;
    constexpr int initArgNum = 3;
    LVector<LString> strArgs = getArg(args...);
    LVector<LString> resultArgs = initArgs;
    LVector<LString::ReplaceSlotStruct> fmtSlots;
    FormatContextStruct context;
    for (size_t i = 0; i < size(); i++)
    {
        auto nowChar = LVector<unsigned short>::at(i);
        // 左大括号"{"
        if (nowChar == openBrace)
        {
            // 遇到最后一个字符
            if (i + 1 >= size())
            {
                break;
            }
            // "{{"
            // 注意:当它出现在一个格式化槽的中间时，不会被视为转义
            if (LVector<unsigned short>::at(i + 1) == openBrace)
            {
                if (!(context.state & slotStarted))
                {
                    // "{{"作为一个slot来记录,将在segmentReplace中替换为"{"
                    fmtSlots.append(LString::ReplaceSlotStruct(i, 2, openBraceSlot));
                }
                i++;
            }
            // 以上情况都不是:格式化槽的开始
            else
            {
                // 如果单独的左大括号出现在一个格式化槽当中,判定为非法!!
                if (context.state & slotStarted)
                {
                    // TODO 处理非法的左大括号。
                    // DO NOT change "context.slotStart" ANYHOW
                }
                else
                {
                    context.state |= slotStarted;
                    context.slotStart = i;
                }
            }
        }
        else if (nowChar == closeBrace)
        {
            // 遇到最后一个字符
            if (i + 1 >= size())
            {
                break;
            }
            // "}}"
            // 注意:当它出现在一个格式化槽的中间时，不会被视为转义
            if (LVector<unsigned short>::at(i + 1) == closeBrace)
            {
                if (!(context.state & slotStarted))
                {
                    // "{{"作为一个slot来记录,将在segmentReplace中替换为"{"
                    fmtSlots.append(ReplaceSlotStruct(i, 2, closeBraceSlot));
                }
                i++;
            }
            // 以上情况都不是:格式化槽的结束
            else
            {
                // 必须在之前已经开始了一个格式化槽,否则非法!!
                if (context.state & slotStarted)
                {
                    context.state &= slotFinish;
                    context.slotEnd = i;
                    LString slotContent = substr(context.slotStart + 1, context.slotEnd - context.slotStart - 1);
                    size_t argIndex = analyseSlot(slotContent, strArgs, context, resultArgs);
                    fmtSlots.append(ReplaceSlotStruct(context.slotStart, context.slotEnd - context.slotStart + 1, argIndex));
                }
                //  如果单独的右大括号出现在一个格式化槽以外,判定为非法!!
                else
                {
                    // TODO 处理非法的右大括号。
                    // DO NOT change "context.slotEnd" ANYHOW
                }
            }
        }
    }
    //  未关闭的左大括号:其后的全部内容都将被忽略
    if (context.slotEnd <= context.slotStart)
    {
        fmtSlots.append(ReplaceSlotStruct(context.slotStart, size() - context.slotStart + 1, nullSlot));
    }
    LString result(*this);
    result.segmentReplace(fmtSlots, resultArgs);
    return result;
}
```

## 2.4 analyseSlot函数

```cpp
size_t LString::analyseSlot(const LString &slotContent, const LVector<LString> &strArgs, FormatContextStruct &context, LVector<LString> &resultArgs)
{
    constexpr uint32_t firstSlotPassed = 0b1 << 1;
    constexpr uint32_t isOrderMode = 0b1 << 2;
    constexpr size_t nullSlot = 0;
    constexpr size_t openBraceSlot = 1;
    constexpr size_t closeBraceSlot = 2;
    constexpr int initArgNum = 3;
    static const auto colon = LChar(":").unicode();
    int colonPos = slotContent.LVector<unsigned short>::indexOf(colon, 0);
    // strIndex:当前用户槽对应第几个strArgs参数(比如在有序模式下由用户指定的参数位置)
    size_t strIndex = 0;
    // resultIndex:当前用户槽对应的替换内容是resultArgs中的第几个索引
    size_t resultIndex = 0;
    // 冒号前内容(或没有冒号的槽的全部内容)保存至indexContent,冒号后内容保存至formatContent(没有冒号的槽它为空)
    LString indexContent, formatContent;
    if (-1 == colonPos)
    {
        indexContent = slotContent;
        formatContent = LString();
    }
    // 槽中存在冒号":"
    else
    {
        // 截取冒号前内容保存至indexContent,冒号后内容保存至formatContent
        indexContent = slotContent.substr(0, colonPos);
        formatContent = slotContent.substr(colonPos + 1, slotContent.size() - colonPos - 1);
    }
    // 解析数字槽部分(冒号前的内容/没有冒号的槽走这里),只有"{}","{数字}","{非法内容}"三种情况
    // 判断indexContent内容是否为空，若为空则是"{}"
    if (!indexContent.size())
    {
        // 判断是否为第一个槽，如果是第一个槽，那么它将决定格式化模式为有序还是无序。每个对应合法槽的返回之前都应该有这个判断
        // "{}",对应合法槽,无序模式
        if (!(context.state & firstSlotPassed))
        {
            context.state |= firstSlotPassed;
        }
        // 判断当前槽是否符合模式，不符合当前模式的槽是非法槽
        // 如果在有序模式下检测到"{}"，它是非法槽
        if (context.state & isOrderMode)
        {
            resultIndex = nullSlot;
        }
        // 合法槽,为其在resultArgs中创建条目
        // 其对应的resultArgs索引是context.nextArg(该变量初始化时已经带上了initArgNum)
        // 其对应的strArgs索引要减去initArgNum
        strIndex = context.nextArg - initArgNum;
        resultIndex = context.nextArg++;
    }
    else
    // indexContent内容不为空,"{数字}","{非法内容}"两种情况
    {
        // 判断槽中内容是否为数字
        bool ok = true;
        int res = indexContent.toInt(&ok);
        if (ok && res >= 0)
        {
            // "{数字}",对应合法槽,有序模式
            if (!(context.state & firstSlotPassed))
            {
                context.state |= firstSlotPassed;
                context.state |= isOrderMode;
            }
            // 如果在无序模式下检测到"{数字}"，它是非法槽
            if (!(context.state & isOrderMode))
            {
                resultIndex = nullSlot;
            }
            else
            // 有序模式下合法的有序槽
            {
                // 用户以数字指定的参数位置就是strArgs中的索引
                strIndex = res;
                // 槽对应的resultArgs索引是context.nextArg(该变量初始化时已经带上了initArgNum)
                resultIndex = context.nextArg++;
            }
        }
        else
        {
            // "{非法内容}"
            resultIndex = nullSlot;
        }
    }
    // 解析冒号后的部分
    // 冒号后为空(无冒号/只有一个冒号):直接创建resultArgs中的对应条目后返回
    if (formatContent.isNull())
    {
        // 只有合法槽才会实际创建条目
        if (nullSlot != resultIndex)
        {
            resultArgs.append(strArgs[strIndex]);
        }
    }
    // 冒号后不为空
    else
    {
        // 只有合法槽才会实际创建条目
        if (nullSlot != resultIndex)
        {
            LString fmtDeal = strArgs[strIndex];
            // TODO 在此处解析冒号后的内容，并将结果作为下一行resultArgs.append的参数
            resultArgs.append(fmtDeal);
        }
    }
    return resultIndex;
}
```
