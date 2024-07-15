---
title: 一些关于空间数据结构的简单研究与实现
date: 2024-06-21 18:09:20
tags: 计算机图形学
---

<meta name="referrer" content="no-referrer"/>

# 1.前言

首先，我们来了解一下计算机中的“视图”“图形”等这些概念。我们日常的语境当中在说“视图”、“照片”、“图形”等等这些和图像有关的概念时，一般都认为它单纯指代一个具有视觉效果的画面——比如高考卷子上立体几何的那个题，你会把它对应到“图形”的概念上；你相册里面那张让你看了就来气的跟前对象的合照，你会把它对应到“照片”的概念上，等等等等。不过在计算机中，“视图”“图像”这些概念的涵义还包含了其他的方面，对于一个图像，计算机所要关注的不止是它呈现的视觉效果，还要使用合适的数字格式存储图像，并按照用户的要求对图像进行分析、处理和加工。我们可以把计算机中的“视图场景”看作一个“虚拟的视图场景”：它在概念上更多地指代的是对图像的数字格式存储以及处理加工的相关操作，不妨回想一下我们前面叙述“空间数据结构”的时候所说的“保存图元信息”“定位查找元素”这些关键词，就对应的是这样的概念，很好理解，数字格式便是图像在计算机中的存在形式——硬盘的体积一共就那么大总不应该是相纸做的吧，那些体积的相纸肯定不可能放得下各位那么多的学习资料&#x1F436;&#x1F436;。这也是前面为什么要用“虚拟”一词，在计算机中说到“图像”“视图”等等时，我们不应直接以日常的语境将它理解成一幅纯粹的“视觉画面”，而是要关注到计算机中实际存储并操作的对象——“数字格式的图像”。我们下面的内容当中也都基于上述概念，讨论的是“数字格式的图像”。

假如我们现在要设计一个视图场景(Scene)，在其中包含很多图元对象(Item)。就像这样:

![image-20240620173747423](https://img-blog.csdnimg.cn/direct/1fd6841c111a4978a1999dfdb0e43834.png)

<!-- more -->

上面就是一个场景，其中包含了大量的线条与色块等等，这些所有的图形要素都统称为"图元"。而场景就负责管理并绘制图元、接收并向对应的图元转发UI事件。我们现在假设场景是静态场景，也就是场景中的图元在初始化以后就不会有任何改变。

现在我们想让这个场景当中的图元响应用户的UI操作，比如说，用鼠标点击场景中的某个位置，场景就需要找到有哪根线条覆盖到了那个位置，然后让那个线条唱跳rap。虽然我们在实现这个逻辑的时候是多么地希望能有一个“点信息表”可以根据鼠标点下的位置直接检索出对应的点上有哪些图元覆盖到这样的相关信息，但场景保存的是“各个图元”相关的信息成一个“图元信息表”，而不太可能把“每个点”相关的信息保存成“点信息表”——如果想用“点”来衡量一整个视图场景的大小，那真是让人吐血，想想你那8K超清的大屏幕上(没有的就祝你早点有&#x1F436;&#x1F436;)算出来有多少个点吧，如果想要保存“每个点被哪些图元覆盖到”这样的信息，需要一个什么规模的二维数组(......)。所以我们知道用户的鼠标落在哪个“点”上之后，要做的是去“图元信息表”寻找“哪些图元覆盖了这个点”，毕竟，场景保存的是“各个图元”的“图元信息表”，不会丧心病狂到去把“每个点”的信息保存成一个“点信息表”。

你可能会说，这多简单，对图元信息表中的每个图元遍历一次，看看哪个图元覆盖了那个位置呗。我们一般管这种做法叫暴力搜索，当然这不是说它完全错误，一个方法只要能达到目的那它就不是绝对的错误；但是必须考虑的事情是，宇宙是有限的，连一个葛立恒数大小的物理概念在我们的宇宙中都找不到，那就不能在讨论一个事情的时候抛开它的时空限制、可用资源限制这些事实层面的东西不谈。比如说，现在场景当中有一千万个图元(不要惊讶，这种情况当然有可能出现，比如说卫星地图或者高品质游戏等一些高精绘图场景，或者你哪天想起来要给你未来的对象展示一下属于码农的浪漫于是把参数调成一千万&#x1F436;&#x1F436;)，那用户每点一下就要暴力搜索数秒(也许经常使用天河一号的朋友们还不用担心在这个数量级下产生这个问题，但是我这个臭写代码的还是不能忘了那些使用PC的人们)，如果这景象出现在一个游戏里那它早已被市场淘汰&#x1F436;&#x1F436;。但是前面我们又说过，“遍历图元”这样的操作逃不掉的，那么有什么能提高效率的方法呢？

计算机图形学对此问题早有研究，并提出了“空间数据结构”(Spatical Data)的概念。很多时候我们需要能够方便地在空间中定位和查找元素的数据结构来处理物体，这称为空间数据结构。空间数据结构将空间划分为多个层次多个区域，并在保存图元信息时使用对应的数据结构记录每个划分出的区域中完全或部分包含的图元并保存，这样就更方便定位和查找空间中的元素，被广泛用在图形学场景中用来加快运算。例如，现在场景中有一千万个图元，原本在遍历的时候需要对这一千万个图元都遍历，但是现在有一种空间数据结构将整个场景不重不漏地划分成了1000个区域，那现在平均每个区域就只有一万个图元了，而用户点到的那个位置一定只落在某个区域当中(谁让它这么没出息只是一个点呢)，所以现在只需要遍历一万个左右的图元了。当然这只是一个比较理想化的模型，实际操作起来还会遇到其他的细节问题，比如说如果有很多图元它就是比你能划出来的区域更大该怎么办呢。而下文所要探讨的，就是均匀网格、BSP这两种空间数据结构在二维空间下的情形以及实现时的各种细节问题。

# 2.均匀网格的概念

均匀网格(Grid)是一种空间数据结构，它使用了一个最为简单朴素的做法，就是将一个空间均匀地划分为大小相等的网格。在二维空间中，均匀网格在一个平面区域内使用等距的直线将其划分为大小相等的网格子区域。把空间划分成均匀网格，使用数组记录 每个网格中包含的图元，就形成了一个简单的空间数据结构。下图展示了一个二维均匀网格的示例：

![20210827143114725](https://img-blog.csdnimg.cn/direct/c27bd5c0319a42ba8ca203af8949c7ff.png)

# 3.BSP的概念

BSP(Binary Space Partitioning，空间二叉划分)也是一种空间数据结构，它可以对一个二维或三维空间进行划分，本文探讨的是二维空间的情形。每次将空间划分为两个部分并对每个划分出的子空间递归重复这个过程，然后使用树结构将空间组合起来，最后得到的就是一棵二叉树，这棵二叉树的每个叶节点对应一块区域，每个非叶节点对应一次划分所用的分割线。这个道理其实很容易想到，因为在进行划分的过程中，所有非叶节点都经历了派生出子节点的过程，也就是说它们经历了“从叶节点变成了非叶节点”的过程，这个过程自然会让这个节点的角色发生改变：当一个节点还没有派生子节点时，它在这棵(尚未完成)的树上是一个叶节点，代表了一个区域；而当它派生出子节点后，它自己就变成了非叶节点，那么它现在就代表了一条分割线，其实很好理解，从一个原本的叶节点“派生子节点”对应的操作就是对原本节点代表的区域进行划分，在划分后这个节点就代表了分割线，而它派生的子节点现在就代表分出的两个子区域，当然，子节点也可以继续对自己进行上面这个操作。

一种简单的BSP划分方式是“轴向划分”，它每次划分都简单地在每个子空间的对称轴上进行划分，对于矩形场景而言，对称轴就是每个子空间水平或垂直的中线轴，而且这样划分出的子空间同样是矩形，对这些子空间也依然从对称轴上进行划分。通常来说，轴向划分最终形成一棵满二叉树：所有非叶节点的度都是2，所有叶节点都在同一层次上，也就是说每一个同级的子区域都会进行划分，直到达到所要求的树深度。我们在划分区域时一般都采取“横竖交替”的策略(很好理解，有谁会一直竖着画呢？双缝干涉实验？)，如果一个节点是按照水平中线轴划分，那么它所派生的子节点再划分的时候就是按照垂直中线轴划分。

我们会发现，轴向划分最终得到的空间数据结构与网格无异。实际上，BSP划分时可以使用任意位置、任意方向的分割线，轴向划分是BSP最简单的划分方式，而在很多实际应用当中，都会基于图元的形状大小以及位置等信息而使用更加灵活的分割线，以使得尽可能多的图元都只落在一个子区域当中，能够提升运算的性能。

# 4.简单的研究与实现

## 4.1 QT的BSPTree

我们先来看有名的图形界面框架QT。QT中的视图场景QGraphicsScene使用的是轴向划分BSP：

![image-20240711095911491](https://img-blog.csdnimg.cn/direct/ca4e1e87bf0e421bae2ff3c3893f887c.png)

nodes数组与index参数用于保存二叉树的信息，如何保存二叉树不是本文探讨的重点。看看这个二叉树是如何生成的：

由用户指定初始的rect和depth，rect参数是矩形对象用于指定BSP所要划分的区域，depth参数用于指定二叉树的深度。二叉树节点Node为如下的数据结构:

![image-20240711104616185](https://img-blog.csdnimg.cn/direct/6378c6d635874a62bdb76ef97fd13b58.png)

这里使用了一个非常巧妙的设计：非叶节点对应的是分割线，但是我们并不需要保存“一条线”下来，由于使用轴向划分的BSP，因此一条分割线只需要它的分割方向(水平/竖直)和它距离场景原点坐标轴的距离就可以确定位置，所以非叶节点保存的是type(Horizental/Vertical)以及当前分割线与type对应坐标轴之间的距离offset。叶节点的type是Leaf，它对应一个区域，区域的信息同样不保存在Node本身当中，而是将每个区域中所包含的图元的信息保存在另一个单独的数组leaves中，叶节点的Node保存一个leafIndex作为leaves数组的下标，这样叶节点对应的区域就是leaves[leafIndex]。由于一个节点只可能是叶节点或非叶节点之一，所以使用union联合offset和leafIndex。

生成二叉树的过程递归调用initialize函数，递归调用的参数rect是本次调用后切出的子区域，depth每次递归都减1。在函数中判断depth，当depth为0时表示已经到达目标深度，则当前的节点为叶节点，type设为Leaf且记录leafIndex；否则当前的节点为非叶节点，并且根据当前节点的type和rect计算出下层节点(child)在递归调用时的参数：下层节点的type应与当前节点的相反，下层节点的rect是当前分割线所分出的两个子区域。

## 4.2 BSP与Grid

写到这里，肯定有读者想发弹幕了，“前面不是刚说过，‘BSP轴向划分最终得到的空间数据结构与网格无异’，那为啥要费劲巴拉的来生成BSP呢？”

是挺费劲巴拉的哈，毕竟这是把我走过的弯路带你们又走了一遍&#x1F436;&#x1F436;。你们一定要相信我，我绝对没有在实现自己的空间数据结构的时候在QT的影响下先实现了一个轴向BSP，然后恍然大悟改成实现网格的&#x1F436;&#x1F436;。当然了，我们这些小辈再走多少路都不如大佬们过的桥多，学无止境呐。

下面将会先后展示BSP与Grid的实现思路以及关键部分的代码/伪代码。

### 4.2.1 BSP

#### 4.2.1.1 数据结构、数据成员

BSP的数据结构为Node所串联成的二叉树。Node的结构如下：

```cpp
/**
 * @enum SplitType
 * @brief 枚举区域分割的类型。
 */
enum SplitType
{
    Horizontal = 0, ///< 水平分割
    Vertical,       ///< 竖直分割
    Leaf            ///< 叶子节点
};
/**
 * @class Node
 * @brief 树的节点，对应分割形成的某块区域。
 */
struct Node
{

    /**
     * @brief 默认构造。
     */
    Node() = default;
    /**
     * @brief 析构函数，处理本节点以及子节点的释放。
     */
    ~Node();
    /**
     * @brief 该节点的分割类型。
     */
    SplitType m_splitType;
    /**
     * @details offset 和 leafIndex 分别对应非叶子节点和叶子节点的数据信息，对于同一个节点这两条数据不可能共存。因此为了节省内存，采用 union
     */
    union
    {
        /**
         * @brief 分割线的横坐标或纵坐标的偏移量，是横坐标还是纵坐标取决于分割类型。
         */
        int m_offset;
        /**
         * @brief 节点的下标，在外部的 leaves 数组中使用。
         */
        int m_leafIndex;
    };
    /**
     * @brief 左子节点指针。
     */
    struct Node *m_left = nullptr;
    /**
     * @brief 右子节点指针。
     */
    struct Node *m_right = nullptr;
};
Node::~Node()
{
    if (!m_left && !m_right) return;

    delete m_left;
    m_left = nullptr;

    delete m_right;
    m_right = nullptr;
}
```

BSP包含的数据成员如下：

```cpp
/**
 * @brief 整棵 BSP 树的根节点。
 * @todo 后续考虑自己实现简单的对象树机制，不使用智能指针
 */
Node *m_root = nullptr;

/**
 * @brief 存储每个叶子节点中的 PicItem (图元) 列表。
 * @details 树构建成功以后，所有的 PicItem 都存储在叶子节点的区域中，为了方便获取，将数据提取到整棵树的数据结构中，叶子节点中存储下标方便访问。注意，每个"Vector<PicItem *>"对应一个节点，因此m_leaves实际上以一维的方式组织各个节点。
 */
Vector<Vector<PicItem *>> m_leaves;

/**
 * @brief 树的深度，对应分割的次数。
 */
int m_depth = 0;

/**
 * @brief 整棵树作用的 2D 平面范围。
 */
Rect m_region;
```



#### 4.2.1.2 树的构造

由用户传入矩形区域region与树的深度depth，程序传入初始根节点并递归调用init函数创建各个子节点。

注：本代码中Rect对象的x1()和y1()返回矩形对象左上角的坐标，x2()和y2()返回矩形对象右下角的坐标，下同。

```cpp
void init(Node *node, const Rect &region, int depth)
{
    // depth > 0 ，继续向下分割
    if (depth > 0)
    {
        // 为了统一命名，使用 left/right 对应逻辑上的 左/右 子节点
        // 水平 Horizontal ： left 为上半边， right 为下半边
        // 垂直 Vertical ： left 为左半边， right 为右半边
        int offsetLeft = 0, offsetRight = 0;
        Rect leftRect, rightRect;
        SplitType newSplit;

        if (SplitType::Horizontal == node->m_splitType)
        {
            // 当前节点为水平分割 Horizontal ，则子节点为 Vertical ， left 为上半边， right 为下半边
            newSplit = SplitType::Vertical;
            leftRect = Rect(region.x1(), region.y1(), region.width(), region.height() / 2);
            rightRect = Rect(leftRect.x1(), leftRect.y2(), region.width(), region.height() / 2);
            offsetLeft = leftRect.x1() + leftRect.width() / 2;
            offsetRight = rightRect.x1() + rightRect.width() / 2;
        }
        else
        {
            // 当前节点为垂直分割 Vertical ，则子节点为 Horizontal ， left 为左半边， right 为右半边
            newSplit = SplitType::Horizontal;
            leftRect = Rect(region.x1(), region.y1(), region.width() / 2, region.height());
            rightRect = Rect(leftRect.x2(), leftRect.y1(), region.width() / 2, region.height());
            offsetLeft = leftRect.y1() + leftRect.height() / 2;
            offsetRight = rightRect.y1() + rightRect.height() / 2;
        }

        node->m_left = new Node;
        node->m_left->m_splitType = newSplit;
        node->m_left->m_offset = offsetLeft;

        node->m_right = new Node;
        node->m_right->m_splitType = newSplit;
        node->m_right->m_offset = offsetRight;

        init(node->m_left, leftRect, depth - 1);
        init(node->m_right, rightRect, depth - 1);
    }
    // 遇到叶子节点
    else
    {
        node->m_splitType = SplitType::Leaf;
        node->m_leafIndex = m_leaves.size();
        m_leaves.append(Vector<PicItem *>());
    }
}
```

#### 4.2.1.3 树的操作

根据用户传入的区域查询命中的叶节点，并执行操作，这个操作可以是对图元的查询、增删等等。

```cpp
/**
 * @brief 定义回调函数类型，用于对叶节点执行操作
 */
using Visitor = std::function<void(LList<LCanvasItem *> &)>;

// 以addItem为例
void addItem(LCanvasItem *item)
{
    auto func = [&item](LList<LCanvasItem *> &items)
    {
        items.append(item);
    };

    update(func, m_root, item->boundingRect());
}

/**
 * @brief 根据所给的区域查询命中的叶子节点，并执行指定的操作。
 * @param visitor 函数对象。用于对查找到的叶子节点执行操作
 * @param node 根节点
 * @param rect 目标区域矩形
 */
void update(const Visitor &visitor, Node *node, const Rect &rect)
{
    if (m_leaves.isEmpty()) return;

    switch (node->m_splitType)
    {
        case SplitType::Leaf:
            visitor(m_leaves[node->m_leafIndex]);
            break;

        case SplitType::Vertical:
        {
            if (rect.x1() < node->m_offset)
            {
                update(visitor, node->m_left, rect);

                if (rect.x2() >= node->m_offset) update(visitor, node->m_right, rect);
            }
            else
            {
                update(visitor, node->m_right, rect);
            }

            break;
        }

        case SplitType::Horizontal:
        {
            if (rect.y1() < node->m_offset)
            {
                update(visitor, node->m_left, rect);

                if (rect.y2() >= node->m_offset) update(visitor, node->m_right, rect);
            }
            else
            {
                update(visitor, node->m_right, rect);
            }

            break;
        }
    }
}
```

### 4.2.2 Grid

#### 4.2.2.1 数据结构、数据成员

均匀网格的数据成员如下：

```cpp
/**
 * @brief 存储每个网格中的 PicItem 列表。
 * @details 树构建成功以后，所有的 PicItem 都存储在网格的区域中，为了方便获取，将数据提取到整个网格的数据结构中，通过数学计算得出下标方便访问。注意，每个"Vector<PicItem *>"对应一个网格，因此m_grids实际上以一维的方式组织各个网格。
 */
Vector<Vector<PicItem *>> m_grids;

/**
 * @brief 网格分割出的每边的区间个数。
 */
int m_sections = 0;

/**
 * @brief 整个网格作用的 2D 平面范围。
 */
Rect m_region;
```

#### 4.2.2.2 网格的构造

均匀网格的成员函数通过如下的方式初始化：

```cpp
/**
 * @brief 带参构造。
 * @param region 需要作用的区域
 * @param splitNum 网格的分割线数量（经纬两个方向分割线数量相同）
 */
Grid::Grid(const Rect &region, int splitNum) : m_region(region), m_sections(splitNum + 1), m_grids(Vector<Vector<PicItem *>>((splitNum + 1) * (splitNum + 1))) {}
```





