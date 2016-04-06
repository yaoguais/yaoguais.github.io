## MQTT协议

目录:

1. 简介
2. 控制报文格式
3. 控制报文-固定报头
4. 控制报文-固定报头-报文类型
5. 控制报文-固定报头-报文类型参数
6. 控制报文-固定报头-剩余长度
7. 控制报文-可变报头
8. 控制报文-有效载荷
9. QoS总结
10. RETAIN总结
11. 发布订阅权限





### 简介

MQTT(Message Queuing Telemetry Transport,消息队列遥测传输)是IBM开发的一个即时通讯协议,
它是一个物联网传输协议,被设计用于轻量级的发布/订阅式消息传输,旨在为低带宽和不稳定的网络环境中的物联网设备提供可靠的网络服务.

MQTT是一个C/S的架构,分为客户端(MQTT Client)和服务端(Broker).
目前流程的MQTT开源程序可以在MQTT的官网上找到.

其中流行的Broker包括: HiveMQ,ActiveMQ,RabbitMQ,Mosquitto,Mosca,MQTT Dashboard,Eclipse IoT,VerneMQ,Solace,CloudMQTT,emqttd等.

流行的Client包括: CloudMQTT,Mosquitto等.

部分开源程序既可以作为Broker,也可以作为Client.

参考资料: 

* [MQTT Wiki](https://github.com/mqtt/mqtt.github.io/wiki/brokers)
* [MQTT协议中文版](https://github.com/mcxiaoke/mqtt)





### 控制报文格式

MQTT协议由三部分组成: 固定报头+可变报头+有效载荷.注意固定报头中的"固定"指的是该包头长度一定在一个范围内.





###  固定报头

固定报头由三部分组成: 报文类型(4bit)+报文类型参数(4bit)+剩余长度(1-4byte).换句话说,固定头部最短2字节,最长5字节.

三个部分具体的含义可以参见[MQTT协议-报文控制格式](https://github.com/mcxiaoke/mqtt/blob/master/mqtt/02-ControlPacketFormat.md)





### 报文类型

报文类型为4个bit位,处于报文第1个字节的7-4位,其值可以表示0-15,其中0与15标识为禁止使用,MQTT目前支持14种报文类型.

包含用于

* 连接的3个: CONNECT,CONNACK,DISCONNECT. 
* 心跳的2个: PINGREQ,PINGRESP. 
* 订阅的2个: SUBSCRIBE,SUBACK. 
* 取消订阅的2个: UNSUBSCRIBE,UNSUBACK. 
* 发布消息的1个: PUBLISH. 
* 消息确认qos1的1个: PUBACK. 
* 消息确认qos2的3个: PUBREC,PUBREL,PUBCOMP.

这里有提到qos,这个我们会在后面专门总结该点.





### 报文类型参数

报文类型参数为4个bit,处于报文第1个字节的3-0位,其值可以表示0-15.

参数主要分为3类:

* 值为2的: PUBREL,SUBSCRIBE,UNSUBSCRIBE.
* 值为0-15的: PUBLISH.
* 值为0的: 剩下的10个报文类型.

PUBLISH的报文类型参数分为3部分: DUP1(1bit) + Qos(2bit) + RETAIN(1bit).

* DUP1 = 控制报文的重复分发标志
* QoS2 = PUBLISH报文的服务质量等级, 其值0,1,2分别代表其服务质量,值3是禁止使用的.
* RETAIN3 = PUBLISH报文的保留标志





### 剩余长度

剩余长度表示当前报文剩余部分的字节数,包括可变报头和有效载荷(即除去固定报头).
最短1个字节,最长4个字节,最大表示256MB(268,435,455)的长度.计算分为两种情况

* 1个字节: 最高位为0,6-0位代表最大127的长度值.
* 2-4个字节: 每个字节的最高位代表是否有后续字节,1为有0为没有.第1个字节7-0位的值记为A,第234个字节的7-0位分别记为BCD,
 那么总长度L = A + B * 128 [ + C * 128 ] [ + D * 128 ],是否有CD以具体情况而定.





### 可变报头

可变报头根据报文类型的不同而不同,有些类型甚至没有可变报头.
可变报头主要是作为报文类型参数的补充,毕竟报文类型参数只有4bit,能表示的内容很有限.
可变报头的具体含义,我们在讲每种报文类型的时候分别阐述.
如果未讲解,可以直接[参照MQTT的Wiki](https://github.com/mcxiaoke/mqtt/blob/master/mqtt/03-ControlPackets.md).




### 有效载荷

有效载荷也是会根据报文类型的不同而不同,有些类型也是没有有效载荷的.
对于我们开发的软件或应用来说,PUBLISH报文类型的有效载荷即我们应用传输的消息,
其消息的格式由我们开发者自己定义,可以是json的,也可以xml的.也可以是二进制类型的,如protobuf等.
有效载荷的具体含义,我们仍然在讲每种报文类型的时候分别阐述.





### QoS总结

可变报头和有效载荷可以参见[MQTT的Wiki](https://github.com/mcxiaoke/mqtt/blob/master/mqtt/01-Introduction.md),
在阅读下面的内容的时候,请先查看Wiki中关于这两部分的内容.

QoS(Quality of Service, 服务质量)在MQTT中有三种类型,分别为: qos0,qos1,qos2.

* qos0: 最多分发一次
* qos1: 至少分发一次
* qos2: 有且只发一次

Qos在MQTT协议中有3种报文类型用到了,分别是 CONNECT,PUBLISH,SUBSCRIBE.我们分别阐述.

* CONNECT

在客户端发起连接的时候,可以指定1个遗嘱消息和目标topic,它的作用是在接受该客户端连接后,
该连接非正常断开(客户端发送DISCONNECT)的情况下,给指定的topic发送遗嘱消息.
比如该通知正在跟他聊天的用户,该用户已掉线.
那么遗嘱消息发送给订阅该topic用户的时候,也用到了qos质量服务.

* PUBLISH

消息从Client发送给Broker的时候,就可以指定qos的等级.

每个qos级别在Client与Broker之间具体怎么执行,
可以[参见MQTT的Wiki](https://github.com/mcxiaoke/mqtt/blob/master/mqtt/04-OperationalBehavior.md).

* SUBSCRIBE

首先在生成一个topic的时候,Broker会为该topic指定一个授权qos(我们称为broker_default_qos).
订阅的时候可以订阅一组topic,并需要为每个topic指定qos(我们称为sub_topic_qos).
而发送消息的时候也需要为每个消息指定一个qos(我们称为pub_msg_qos).
那么它们之间有什么关系呢?

ClientA在发送消息MessageA给Broker的时候,消息在ClientA与Broker之间流程是按照ClientA指定的qos进行的,而跟broker_default_qos无关.
但是在如果此时ClientB订阅这个topic,
那么MessageA在ClientB与Broker之间的qos是按照三者(broker_default_qos,sub_topic_qos,pub_msg_qos)的最小值决定的.

订阅的时候为一组topic分别指定了qos,Broker会立即返回SUBACK报文,并为每个topic指定一个qos(我们称为sub_resp_qos),
这个sub_resp_qos必须是broker_default_qos与sub_topic_qos的最小值.
但是这个值并不能决定该topic中每个消息最终的qos,其最终的qos就是上一条所描述的.





### RETAIN总结

Retain为保留的意思.MQTT协议中涉及到该字段的地方有两处,一处是CONNECT时为遗嘱消息指定的,一处是PUBLISH时为消息指定的.

如果Retain被标识为1,那么服务端必须存储这个应用消息和它的QoS,以便它可以被分发给未来的主题名匹配的订阅者.

一个新的订阅建立时,对每个匹配的主题名,如果存在最近保留的消息,它必须被发送给这个订阅者.

如果服务端收到一条RETAIN标志为1的qos0消息,它必须丢弃之前为那个主题保留的任何消息。
它应该将这个新的QoS0消息当作那个主题的新保留消息.但是任何时候都可以选择丢弃它,如果这种情况发生了,那个主题将没有保留消息.





### 发布订阅权限

在发布的时候,我们分两种情况讨论.
当为qos0时,Broker并不会发送消息给Client,那么这时候Client自然不知道有没发送成功.
当为qos1和qos2时,Broker会分别发送PUBACK PUBREC等报文回来,但是可变报头中只有2字节的报文标识符,
并没有标识是否消息是否有权限发送.

可以看出MQTT协议在设计的时候并没有预留发布的权限验证字段.那么有没有什么解决方案呢?
目前来看的话,我们可以在Broker端将所有不符合权限要求的消息丢掉即可.

在订阅的时候,Client需要指定一组topic和每个topic对应的qos,然后Broker原样返回topic和Broker允许的qos.
Broker返回qos的可以是0 1 2,如果返回的是0x80,那么就代表订阅失败,其原因最可能就是权限不够或者订阅者太过庞大.